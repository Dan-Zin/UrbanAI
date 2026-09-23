"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { seededRandom } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { sunAt } from "@/lib/sun";
import { ZONE_COLORS } from "@/components/scene/zoneColors";
import {
  applyGroundMapping,
  enhanceGroundImagery,
  loadGroundImagery,
  type GroundImagery,
} from "@/lib/satellite";
import {
  normalizeOsmColor,
  type OsmArea,
  type OsmBuilding,
  type OsmRail,
  type OsmRoad,
  type OsmTree,
  type Surroundings,
} from "@/services/osm";
import type { FacadeSpec, StreetSpec } from "@/services/ai";

/** Safe OSM colour parser — hex, CSS names, or Russian words like «красный». */
function parseOsmColor(c?: string): THREE.Color | null {
  const hex = normalizeOsmColor(c);
  if (!hex) return null;
  try {
    return new THREE.Color(hex);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Procedural facade textures — a tile of windows, some lit.           */
/* Shared across buildings (4 variants), cloned per-building for UVs.  */
/* ------------------------------------------------------------------ */

/** One texture tile covers this many meters of facade. */
const TILE_METERS = 12;
const TEX_SIZE = 1024;
const PX_PER_M = TEX_SIZE / TILE_METERS;

type FacadeStyle = "plaster" | "brick" | "panel" | "wood";

// Real-life palettes: old Taganrog center is pastel plaster (ochre, beige,
// white, pistachio); soviet-era housing is red/silicate brick or gray panel.
const STYLE_PALETTES: Record<FacadeStyle, string[]> = {
  plaster: ["#d9b96c", "#e6d7ae", "#ded8cb", "#bccaa9", "#d9a89a", "#cfa75e"],
  brick: ["#8f4a35", "#9c5744", "#a35f45", "#cfc9bd"],
  panel: ["#b7b3ab", "#c2bdb2", "#a8a49e"],
  wood: ["#8a6a4a", "#75563b"],
};

/** Decide facade style + base colour from OSM tags, with era heuristics. */
function pickFacade(b: OsmBuilding): { style: FacadeStyle; color: string } {
  let style: FacadeStyle | null = null;
  const m = (b.material ?? "").toLowerCase();
  if (m) {
    if (/brick/.test(m)) style = "brick";
    else if (/panel|concrete|cement|block/.test(m)) style = "panel";
    else if (/wood|timber|log/.test(m)) style = "wood";
    else style = "plaster";
  }
  if (!style) {
    if (b.kind === "apartments") style = b.levels >= 6 ? "panel" : "brick";
    else if (/industrial|warehouse|garage|garages/.test(b.kind)) style = "panel";
    else if (/house|detached|terrace|bungalow|cabin/.test(b.kind)) {
      const h = b.id % 10;
      style = h < 4 ? "brick" : h < 8 ? "plaster" : "wood";
    } else style = "plaster"; // historic center default
  }
  const palette = STYLE_PALETTES[style];
  return { style, color: palette[b.id % palette.length] };
}

function shade(hex: string, l: number) {
  return "#" + new THREE.Color(hex).offsetHSL(0, 0, l).getHexString();
}

function drawMaterialBase(
  ctx: CanvasRenderingContext2D,
  style: FacadeStyle,
  color: string,
  rand: () => number
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  if (style === "brick") {
    // running-bond courses: ~0.1m rows, ~0.3m bricks, light mortar joints
    const rowH = 0.1 * PX_PER_M;
    const brickW = 0.3 * PX_PER_M;
    ctx.fillStyle = shade(color, 0.18); // mortar
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    let row = 0;
    for (let y = 0; y < TEX_SIZE; y += rowH, row++) {
      const off = row % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < TEX_SIZE + brickW; x += brickW) {
        ctx.fillStyle = shade(color, (rand() - 0.5) * 0.09);
        ctx.fillRect(x + off + 1, y + 1, brickW - 2, rowH - 2);
      }
    }
  } else if (style === "panel") {
    // storey-height concrete panels with recessed seams
    const seam = 3 * PX_PER_M;
    for (let x = 0; x < TEX_SIZE; x += seam) {
      for (let y = 0; y < TEX_SIZE; y += seam) {
        ctx.fillStyle = shade(color, (rand() - 0.5) * 0.06);
        ctx.fillRect(x, y, seam, seam);
      }
    }
    // concrete grain
    for (let i = 0; i < 4200; i++) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? "0,0,0" : "255,255,255"},${0.02 + rand() * 0.045})`;
      ctx.fillRect(rand() * TEX_SIZE, rand() * TEX_SIZE, 1 + rand() * 2, 1 + rand() * 2);
    }
    // recessed seams: dark groove + light lip below/right
    for (let p = 0; p <= TEX_SIZE; p += seam) {
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(p - 2, 0, 4, TEX_SIZE);
      ctx.fillRect(0, p - 2, TEX_SIZE, 4);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(p + 2, 0, 2, TEX_SIZE);
      ctx.fillRect(0, p + 2, TEX_SIZE, 2);
    }
    // rust/dirt streaks running down from seam joints
    for (let i = 0; i < 30; i++) {
      const sx = Math.floor(rand() * 4) * seam + (rand() - 0.5) * 30;
      const sy = Math.floor(rand() * 4) * seam;
      const grad = ctx.createLinearGradient(0, sy, 0, sy + 60 + rand() * 160);
      grad.addColorStop(0, `rgba(58,50,40,${0.10 + rand() * 0.12})`);
      grad.addColorStop(1, "rgba(58,50,40,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, 3 + rand() * 7, 60 + rand() * 160);
    }
  } else if (style === "wood") {
    // horizontal siding boards ~0.22m
    const board = 0.22 * PX_PER_M;
    for (let y = 0; y < TEX_SIZE; y += board) {
      ctx.fillStyle = shade(color, (rand() - 0.5) * 0.12);
      ctx.fillRect(0, y, TEX_SIZE, board - 1);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, y + board - 1, TEX_SIZE, 1);
    }
  } else {
    // plaster: soft noise + faint storey cornice lines
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${0.015 + rand() * 0.03})`;
      ctx.fillRect(rand() * TEX_SIZE, rand() * TEX_SIZE, 1 + rand() * 3, 1 + rand() * 3);
    }
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    for (let y = 3 * PX_PER_M; y < TEX_SIZE; y += 3 * PX_PER_M) {
      ctx.fillRect(0, y - 2, TEX_SIZE, 4);
    }
  }
}

/** Window grid geometry shared by the colour map and the emissive map. */
function windowRect(cx: number, cy: number) {
  const cw = TEX_SIZE / 4;
  const ch = TEX_SIZE / 4;
  return {
    x: cx * cw + cw * 0.3,
    y: cy * ch + ch * 0.24,
    w: cw * 0.4,
    h: ch * 0.5,
  };
}

const facadeMapCache = new Map<string, THREE.Texture>();
const emissiveCache = new Map<number, THREE.Texture>();

function toTexture(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / TILE_METERS, 1 / TILE_METERS);
  t.anisotropy = 4;
  return t;
}

/** Lit-window pattern; variant keyed so neighbours differ. */
function getEmissiveTexture(variant: number) {
  const cached = emissiveCache.get(variant);
  if (cached) return cached;
  const rand = seededRandom(3.77 + variant * 2.13);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  for (let cx = 0; cx < 4; cx++) {
    for (let cy = 0; cy < 4; cy++) {
      if (rand() < 0.3) {
        const { x, y, w, h } = windowRect(cx, cy);
        ctx.fillStyle = `rgba(255,214,140,${0.75 + rand() * 0.25})`;
        ctx.fillRect(x, y, w, h);
      }
    }
  }
  const t = toTexture(canvas);
  emissiveCache.set(variant, t);
  return t;
}

/** Window-with-arched-top path (arch bulges above y by w/2). */
function archPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y);
  ctx.arc(x + w / 2, y, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function getFacadeMap(
  style: FacadeStyle,
  color: string,
  variant: number,
  spec?: FacadeSpec
) {
  const key = `${style}|${color}|${variant}|${
    spec
      ? `${spec.trimColor}${spec.windowShape}${spec.columns ? 1 : 0}${spec.corniceBands ? 1 : 0}`
      : ""
  }`;
  const cached = facadeMapCache.get(key);
  if (cached) return cached;

  const rand = seededRandom(
    1.13 + variant * 4.7 + color.charCodeAt(1) * 0.017 + style.length
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;

  drawMaterialBase(ctx, style, color, rand);

  const trim = spec?.trimColor ?? "#f2eee2";
  const arched = spec?.windowShape === "arched";

  // classical pilasters between window axes (portico look)
  if (spec?.columns) {
    const pw = 0.6 * PX_PER_M;
    const cw = TEX_SIZE / 4;
    for (let k = 0; k < 4; k++) {
      const px = k * cw - pw / 2;
      for (const xx of [px, px + TEX_SIZE]) {
        // shaft with side shading
        const grad = ctx.createLinearGradient(xx, 0, xx + pw, 0);
        grad.addColorStop(0, shade(trim, -0.18));
        grad.addColorStop(0.5, trim);
        grad.addColorStop(1, shade(trim, -0.22));
        ctx.fillStyle = grad;
        ctx.fillRect(xx, 0, pw, TEX_SIZE);
        // capitals at every storey line
        ctx.fillStyle = shade(trim, 0.06);
        for (let y = 0; y < TEX_SIZE; y += 3 * PX_PER_M) {
          ctx.fillRect(xx - 6, y - 14, pw + 12, 16);
        }
      }
    }
  }

  // cornice bands at storey lines
  if (spec?.corniceBands) {
    for (let y = 3 * PX_PER_M; y <= TEX_SIZE; y += 3 * PX_PER_M) {
      ctx.fillStyle = trim;
      ctx.fillRect(0, y - 8, TEX_SIZE, 10);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, y + 2, TEX_SIZE, 4);
    }
  }

  const emRand = seededRandom(3.77 + (variant % 3) * 2.13); // mirror emissive
  for (let cx = 0; cx < 4; cx++) {
    for (let cy = 0; cy < 4; cy++) {
      const { x, y, w, h } = windowRect(cx, cy);
      const lit = emRand() < 0.3;
      if (lit) emRand(); // consume the alpha sample too

      // trim surround on plaster/brick — very characteristic of old Taganrog
      if (style === "plaster" || style === "brick" || spec) {
        ctx.fillStyle = trim;
        if (arched) {
          archPath(ctx, x - 10, y - 4, w + 20, h + 14);
          ctx.fill();
        } else {
          ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
        }
      }

      // recess shadow + window frame (aged PVC/wood)
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      if (arched) {
        archPath(ctx, x - 3, y + 2, w + 6, h + 4);
        ctx.fill();
      } else {
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      }
      ctx.fillStyle = style === "panel" ? "#c9cbc8" : "#ddd8ce";
      if (arched) {
        archPath(ctx, x, y + 4, w, h - 4);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }

      // glass panes inside the frame
      const fw = 5; // frame bar thickness
      const gx = x + fw;
      const gy = y + fw;
      const gw = w - fw * 2;
      const gh = h - fw * 2;
      if (lit) {
        ctx.fillStyle = "#e8d9a8";
        if (arched) {
          archPath(ctx, gx, gy + 4, gw, gh - 4);
          ctx.fill();
        } else {
          ctx.fillRect(gx, gy, gw, gh);
        }
      } else if (arched) {
        ctx.fillStyle = "#1a222d";
        archPath(ctx, gx, gy + 4, gw, gh - 4);
        ctx.fill();
        ctx.fillStyle = "rgba(160,185,210,0.08)";
        archPath(ctx, gx, gy + 4, gw * 0.55, gh - 4);
        ctx.fill();
      } else {
        const glass = ctx.createLinearGradient(0, gy, 0, gy + gh);
        glass.addColorStop(0, "#2b3542");
        glass.addColorStop(0.55, "#141a24");
        glass.addColorStop(1, "#1c2531");
        ctx.fillStyle = glass;
        ctx.fillRect(gx, gy, gw, gh);
        // diagonal sky reflection
        ctx.fillStyle = "rgba(160,185,210,0.10)";
        ctx.beginPath();
        ctx.moveTo(gx, gy + gh * 0.55);
        ctx.lineTo(gx + gw * 0.6, gy);
        ctx.lineTo(gx + gw, gy);
        ctx.lineTo(gx, gy + gh);
        ctx.closePath();
        ctx.fill();
      }
      // frame cross bars
      ctx.fillStyle = style === "panel" ? "#c9cbc8" : "#ddd8ce";
      ctx.fillRect(x + w / 2 - 2, y, 4, h);
      ctx.fillRect(x, y + h * 0.42, w, 4);

      // window sill: light lip + drop shadow under it
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x - 6, y + h + 2, w + 12, 4);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x - 6, y + h + 6, w + 12, 4);

      // balconies on alternating window columns of soviet panel/brick blocks
      if ((style === "panel" || style === "brick") && (cx + variant) % 2 === 1) {
        const bx = x - 14;
        const bw = w + 28;
        const bTop = y + h * 0.32;
        const bh = h * 0.78;
        // railing bars
        ctx.fillStyle = "rgba(84,90,96,0.85)";
        for (let bxx = bx; bxx <= bx + bw - 2; bxx += 8) {
          ctx.fillRect(bxx, bTop, 3, bh);
        }
        // top rail + concrete slab bottom
        ctx.fillStyle = "#7d8288";
        ctx.fillRect(bx - 3, bTop - 3, bw + 6, 5);
        ctx.fillStyle = shade(color, -0.14);
        ctx.fillRect(bx - 5, bTop + bh - 4, bw + 10, 10);
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.fillRect(bx - 5, bTop + bh + 6, bw + 10, 4);
      }
    }
  }

  const t = toTexture(canvas);
  facadeMapCache.set(key, t);
  return t;
}

/* ------------------------------------------------------------------ */
/* Real building: extruded OSM footprint with windowed facades         */
/* ------------------------------------------------------------------ */

/** Gabled roof for (near-)rectangular footprints: two slopes + two gables. */
function gableGeometry(quad: [number, number][], baseY: number) {
  const [p0, p1, p2, p3] = quad;
  const len = (a: [number, number], b: [number, number]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1]);
  // ridge runs parallel to the longer edge pair
  const alongE0 = len(p0, p1) + len(p2, p3) >= len(p1, p2) + len(p3, p0);
  const [a0, a1, b0, b1] = alongE0 ? [p0, p1, p2, p3] : [p1, p2, p3, p0];
  // gable ends: a1->b0 and b1->a0
  const m1: [number, number] = [(a1[0] + b0[0]) / 2, (a1[1] + b0[1]) / 2];
  const m2: [number, number] = [(b1[0] + a0[0]) / 2, (b1[1] + a0[1]) / 2];
  const span = Math.min(len(a1, b0), len(b1, a0));
  const ridgeY = baseY + THREE.MathUtils.clamp(span * 0.38, 0.8, 3);

  const v = (p: [number, number], y: number) => [p[0], y, p[1]];
  // prettier-ignore
  const tris = [
    // slope 1 (a0-a1 eave -> ridge m1-m2)
    v(a0, baseY), v(a1, baseY), v(m1, ridgeY),
    v(a0, baseY), v(m1, ridgeY), v(m2, ridgeY),
    // slope 2 (b0-b1 eave -> ridge m2-m1)
    v(b0, baseY), v(b1, baseY), v(m2, ridgeY),
    v(b0, baseY), v(m2, ridgeY), v(m1, ridgeY),
    // gable triangles
    v(a1, baseY), v(b0, baseY), v(m1, ridgeY),
    v(b1, baseY), v(a0, baseY), v(m2, ridgeY),
  ].flat();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  geo.computeVertexNormals();
  return geo;
}

const GABLE_KINDS = /^(house|detached|terrace|bungalow|cabin|hut|yes)$/;

/** Offsets a footprint outward by `d` meters (vertex-normal approximation). */
function offsetPolygon(
  poly: [number, number][],
  d: number
): [number, number][] {
  const n = poly.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of poly) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  return poly.map(([x, z], i) => {
    const [xp, zp] = poly[(i - 1 + n) % n];
    const [xn, zn] = poly[(i + 1) % n];
    const norm = (vx: number, vz: number) => {
      const l = Math.hypot(vx, vz) || 1;
      return [vx / l, vz / l];
    };
    const [e1x, e1z] = norm(x - xp, z - zp);
    const [e2x, e2z] = norm(xn - x, zn - z);
    let [nx, nz] = norm(-e1z - e2z, e1x + e2x);
    if ((x - cx) * nx + (z - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    return [x + nx * d, z + nz * d];
  });
}

/* ------------------------------------------------------------------ */
/* Building entrances (подъезды): door, canopy, step, lamp             */
/* ------------------------------------------------------------------ */

const NO_ENTRANCE_KINDS = /^(garage|garages|shed|hut|greenhouse|roof|construction|ruins)$/;

interface EntranceSpot {
  x: number;
  z: number;
  angle: number;
}

/* ------------------------------------------------------------------ */
/* Placement validation: nothing may spawn inside buildings / on roads */
/* ------------------------------------------------------------------ */

export type IsFree = (x: number, z: number, clearance?: number) => boolean;

function distToSegment(
  px: number,
  pz: number,
  [x1, z1]: [number, number],
  [x2, z2]: [number, number]
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}

export function buildPlacementChecker(data: Surroundings): IsFree {
  return (x, z, clearance = 0.5) => {
    for (const b of data.buildings) {
      if (pointInPolygon(x, z, b.footprint)) return false;
    }
    for (const r of data.roads) {
      const half = r.width / 2 + clearance;
      for (let i = 0; i < r.path.length - 1; i++) {
        if (distToSegment(x, z, r.path[i], r.path[i + 1]) < half) return false;
      }
    }
    for (const r of data.rails) {
      for (let i = 0; i < r.path.length - 1; i++) {
        if (distToSegment(x, z, r.path[i], r.path[i + 1]) < 2 + clearance) return false;
      }
    }
    return true;
  };
}

interface EdgeFrame {
  x1: number;
  z1: number;
  ex: number; // unit vector along the edge
  ez: number;
  len: number;
  nx: number; // outward unit normal
  nz: number;
}

/** Longest footprint edge with its outward normal — the "main facade". */
/** All footprint edges as frames, outward normal verified against the own
 *  polygon (robust for L-shaped/concave buildings), longest first. */
function edgeFrames(poly: [number, number][]): EdgeFrame[] {
  const n = poly.length;
  const frames: EdgeFrame[] = [];
  for (let i = 0; i < n; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % n];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 4) continue; // too short to host anything
    const ex = (x2 - x1) / len;
    const ez = (z2 - z1) / len;
    let nx = -ez;
    let nz = ex;
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    // outward side = the one NOT inside the own footprint
    if (pointInPolygon(mx + nx * 0.6, mz + nz * 0.6, poly)) {
      nx = -nx;
      nz = -nz;
      if (pointInPolygon(mx + nx * 0.6, mz + nz * 0.6, poly)) continue; // degenerate
    }
    frames.push({ x1, z1, ex, ez, len, nx, nz });
  }
  return frames.sort((a, b) => b.len - a.len);
}

/** The facade edge for furniture: longest edge with free space in front. */
function mainEdge(poly: [number, number][], isFree?: IsFree): EdgeFrame | null {
  const frames = edgeFrames(poly);
  if (!isFree) return frames[0] ?? null;
  for (const e of frames.slice(0, 4)) {
    const mx = e.x1 + e.ex * (e.len / 2) + e.nx * 3;
    const mz = e.z1 + e.ez * (e.len / 2) + e.nz * 3;
    if (isFree(mx, mz, 0.5)) return e;
  }
  return null;
}

function footprintArea(poly: [number, number][]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

function computeEntrances(b: OsmBuilding, isFree: IsFree): EntranceSpot[] {
  if (NO_ENTRANCE_KINDS.test(b.kind)) return [];
  // tiny outbuildings (sheds mapped as building=yes) get no entrance
  if (footprintArea(b.footprint) < 45) return [];

  const multiEntrance = b.kind === "apartments" && b.levels >= 2;

  // try the longest edges until one yields at least one valid door spot
  for (const e of edgeFrames(b.footprint).slice(0, 3)) {
    const count = multiEntrance
      ? Math.min(4, Math.max(1, Math.round(e.len / 22)))
      : 1;
    const spots: EntranceSpot[] = [];
    for (let k = 0; k < count; k++) {
      const t = ((k + 0.5) / count) * e.len;
      const x = e.x1 + e.ex * t;
      const z = e.z1 + e.ez * t;
      // the space in front of the door must be genuinely free
      if (!isFree(x + e.nx * 1.3, z + e.nz * 1.3, 0.3)) continue;
      spots.push({
        x: x + e.nx * 0.05,
        z: z + e.nz * 0.05,
        angle: Math.atan2(e.nx, e.nz),
      });
    }
    if (spots.length > 0) return spots;
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Street furniture reconstructed from the photo analysis              */
/* ------------------------------------------------------------------ */

function BenchSmall() {
  return (
    <group>
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[1.5, 0.06, 0.42]} />
        <meshStandardMaterial color="#7c5a33" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.68, -0.19]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[1.5, 0.45, 0.05]} />
        <meshStandardMaterial color="#7c5a33" roughness={0.8} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} castShadow position={[x, 0.2, 0]}>
          <boxGeometry args={[0.07, 0.4, 0.38]} />
          <meshStandardMaterial color="#33383c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function BinSmall() {
  return (
    <group>
      <mesh castShadow position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 0.55, 10]} />
        <meshStandardMaterial color="#3c4a3e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.57, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 10]} />
        <meshStandardMaterial color="#2b352d" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function StreetFurniture({
  building,
  street,
  isFree,
}: {
  building: OsmBuilding;
  street: StreetSpec;
  isFree: IsFree;
}) {
  const layout = useMemo(() => {
    // furniture goes along the facade that actually has open space in front
    const e = mainEdge(building.footprint, isFree);
    if (!e) return null;
    const at = (t: number, off: number): [number, number] => [
      e.x1 + e.ex * t * e.len + e.nx * off,
      e.z1 + e.ez * t * e.len + e.nz * off,
    ];

    const benches: [number, number][] = [];
    const nBench = Math.min(street.benches, 4);
    for (let i = 0; i < nBench; i++) {
      const p = at((i + 1) / (nBench + 1), 3.1);
      if (isFree(p[0], p[1], 0.4)) benches.push(p);
    }

    const bins: [number, number][] = [];
    const nBin = Math.min(street.bins, 3);
    for (let i = 0; i < nBin; i++) {
      const p = at(0.15 + (0.7 * i) / Math.max(1, nBin - 1), 2.3);
      if (isFree(p[0], p[1], 0.3)) bins.push(p);
    }

    // fence: posts validated individually; rails only between adjacent posts
    const posts: [number, number][] = [];
    const segments: { mid: [number, number]; len: number; rot: number }[] = [];
    if (street.fence) {
      const spacing = 2;
      const count = Math.min(24, Math.floor(e.len / spacing));
      const raw = Array.from({ length: count + 1 }, (_, i) =>
        at(i / count, 4.4)
      );
      const kept = raw.map((p) => isFree(p[0], p[1], 0.25));
      let keptCount = 0;
      for (let i = 0; i <= count; i++) {
        if (kept[i]) {
          posts.push(raw[i]);
          keptCount++;
        }
        if (i < count && kept[i] && kept[i + 1]) {
          const [ax, az] = raw[i];
          const [bx, bz] = raw[i + 1];
          segments.push({
            mid: [(ax + bx) / 2, (az + bz) / 2],
            len: Math.hypot(bx - ax, bz - az),
            rot: Math.atan2(bx - ax, bz - az),
          });
        }
      }
      // a fence that is mostly blocked looks broken — drop it entirely
      if (keptCount < (count + 1) * 0.55) {
        posts.length = 0;
        segments.length = 0;
      }
    }

    const trees: { id: number; position: [number, number] }[] = [];
    const nTree = Math.min(street.extraTrees, 3);
    for (let i = 0; i < nTree; i++) {
      const p = at(0.2 + (0.6 * i) / Math.max(1, nTree - 1), 5.6);
      if (isFree(p[0], p[1], 1.2)) {
        trees.push({ id: building.id * 31 + i * 7 + 3, position: p });
      }
    }

    return { facing: Math.atan2(e.nx, e.nz), benches, bins, posts, segments, trees };
  }, [building, street, isFree]);

  if (!layout) return null;

  return (
    <group>
      {layout.benches.map((p, i) => (
        <group
          key={`bench-${i}`}
          position={[p[0], 0, p[1]]}
          rotation={[0, layout.facing, 0]}
        >
          <BenchSmall />
        </group>
      ))}
      {layout.bins.map((p, i) => (
        <group key={`bin-${i}`} position={[p[0], 0, p[1]]}>
          <BinSmall />
        </group>
      ))}
      {layout.posts.map((p, i) => (
        <mesh key={`post-${i}`} position={[p[0], 0.45, p[1]]} castShadow>
          <boxGeometry args={[0.07, 0.9, 0.07]} />
          <meshStandardMaterial color="#2f3a45" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      {layout.segments.map((s, i) => (
        <group key={`rail-${i}`}>
          {[0.35, 0.8].map((h) => (
            <mesh
              key={h}
              position={[s.mid[0], h, s.mid[1]]}
              rotation={[0, s.rot, 0]}
            >
              <boxGeometry args={[0.04, 0.05, s.len]} />
              <meshStandardMaterial color="#2f3a45" metalness={0.6} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
      {layout.trees.map((t) => (
        <StreetTree key={`tr-${t.id}`} tree={t} />
      ))}
    </group>
  );
}

function Entrances({
  building,
  night,
  isFree,
}: {
  building: OsmBuilding;
  night: number;
  isFree: IsFree;
}) {
  const spots = useMemo(
    () => computeEntrances(building, isFree),
    [building, isFree]
  );
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.angle, 0]}>
          {/* door surround */}
          <mesh position={[0, 1.3, 0.04]} castShadow>
            <boxGeometry args={[2, 2.6, 0.1]} />
            <meshStandardMaterial color="#787b7e" roughness={0.85} />
          </mesh>
          {/* the door itself */}
          <mesh position={[0, 1.15, 0.12]} castShadow>
            <boxGeometry args={[1.4, 2.3, 0.08]} />
            <meshStandardMaterial color="#41464c" roughness={0.6} metalness={0.35} />
          </mesh>
          {/* canopy */}
          <mesh position={[0, 2.75, 0.55]} castShadow>
            <boxGeometry args={[2.3, 0.12, 1.2]} />
            <meshStandardMaterial color="#4c5054" roughness={0.7} />
          </mesh>
          {/* step */}
          <mesh position={[0, 0.09, 0.5]} receiveShadow>
            <boxGeometry args={[2.1, 0.18, 1]} />
            <meshStandardMaterial color="#5b5e61" roughness={0.95} />
          </mesh>
          {/* entrance lamp under the canopy */}
          <mesh position={[0, 2.6, 0.5]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              color="#ffe6b0"
              emissive="#ffb954"
              emissiveIntensity={0.15 + 2.6 * night}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RealBuilding({
  building,
  isFree,
  imagery,
}: {
  building: OsmBuilding;
  isFree: IsFree;
  imagery: GroundImagery | null;
}) {
  const isActive = useStore((s) => s.activeBuildingId === building.id);
  const setActiveBuilding = useStore((s) => s.setActiveBuilding);
  const textureOverride = useStore((s) => s.buildingTextures[building.id]);
  const analysis = useStore((s) => s.buildingSpecs[building.id]);
  // Windows glow at night, fade by day (bucketed so materials rebuild rarely)
  const timeOfDay = useStore((s) => s.timeOfDay);
  const daylight = sunAt(timeOfDay).daylight;
  const windowGlow = daylight < 0.25 ? 1.2 : daylight < 0.6 ? 0.55 : 0.12;

  const {
    geometry,
    roofGeometry,
    gableGeo,
    edges,
    materials,
    roofMat,
    plinthGeo,
    plinthMat,
  } = useMemo(() => {
    // rotation.x = -PI/2 maps shape (px, py) -> world (px, 0, -py)
    const pts = building.footprint.map(([x, z]) => new THREE.Vector2(x, -z));
    // OSM ways have arbitrary winding; extrude needs CCW for outward normals
    if (THREE.ShapeUtils.area(pts) < 0) pts.reverse();
    const shape = new THREE.Shape(pts);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: building.height,
      bevelEnabled: false,
    });
    const roofGeometry = new THREE.ShapeGeometry(shape);
    const edges = new THREE.EdgesGeometry(geometry, 25);

    // plinth (цоколь): slightly outset dark base band
    const plinthPts = offsetPolygon(building.footprint, 0.09).map(
      ([x, z]) => new THREE.Vector2(x, -z)
    );
    if (THREE.ShapeUtils.area(plinthPts) < 0) plinthPts.reverse();
    const plinthGeo = new THREE.ExtrudeGeometry(new THREE.Shape(plinthPts), {
      depth: 0.75,
      bevelEnabled: false,
    });

    const rand = seededRandom(building.id * 0.013);
    // Facade priority: neural photo reconstruction > OSM tags > heuristics
    let { style, color } = pickFacade(building);
    if (analysis) {
      style =
        analysis.facade.material === "stone"
          ? "plaster"
          : (analysis.facade.material as FacadeStyle);
      color = analysis.facade.color;
    }
    const osmColor = analysis ? null : parseOsmColor(building.colour);
    const baseHex = osmColor ? "#" + osmColor.getHexString() : color;
    const base = new THREE.Color(baseHex);
    const variant = building.id % 3;
    let map: THREE.Texture;
    let emissiveMap: THREE.Texture | null = getEmissiveTexture(variant);
    if (textureOverride) {
      // AI-generated facade (Mapillary photo -> FLUX, or mock)
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      map = loader.load(textureOverride);
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.colorSpace = THREE.SRGBColorSpace;
      map.repeat.set(1 / TILE_METERS, 1 / TILE_METERS);
      map.anisotropy = 4;
      emissiveMap = null; // the generated texture carries its own lighting
    } else {
      map = getFacadeMap(style, baseHex, variant, analysis?.facade);
    }

    const sideMat = new THREE.MeshStandardMaterial({
      color: "#ffffff", // colour is baked into the texture
      map,
      ...(emissiveMap
        ? {
            emissive: new THREE.Color("#ffd28a"),
            emissiveMap,
            emissiveIntensity: windowGlow,
          }
        : {}),
      roughness: style === "brick" ? 0.92 : style === "wood" ? 0.8 : 0.87,
      metalness: 0.03,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: base.clone().offsetHSL(0, 0, -0.22),
      roughness: 0.95,
    });

    // Gabled roof: explicit roof:shape, or a low quad house by default
    const isQuad = building.footprint.length === 4;
    const wantsGable =
      isQuad &&
      (/gabled|hipped/.test(building.roofShape ?? "") ||
        (!building.roofShape &&
          building.height <= 7 &&
          GABLE_KINDS.test(building.kind)));
    const gableGeo = wantsGable
      ? gableGeometry(building.footprint, building.height)
      : null;
    // Flat roofs get their REAL roof from the satellite orthophoto;
    // gabled roofs stay geometric (slopes aren't visible in an orthophoto)
    const detail = imagery?.detail;
    const detailHalf = detail ? detail.size * 0.46 : 0;
    const roofOnDetail =
      !!detail &&
      building.footprint.every(([x, z]) => Math.abs(x) <= detailHalf && Math.abs(z) <= detailHalf);
    let roofMat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    if (imagery && !gableGeo) {
      const roofTex = (roofOnDetail ? detail!.texture : imagery.texture).clone();
      applyGroundMapping(roofTex, roofOnDetail ? detail!.size : imagery.size);
      roofTex.needsUpdate = true;
      roofMat = new THREE.MeshBasicMaterial({
        map: roofTex,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
    } else {
      roofMat = new THREE.MeshStandardMaterial({
        color:
          parseOsmColor(building.roofColour) ??
          (gableGeo
            ? new THREE.Color("#6e4634").offsetHSL(0, 0, (rand() - 0.5) * 0.1)
            : capMat.color),
        roughness: 0.9,
        side: THREE.DoubleSide, // OSM quad winding is arbitrary
      });
    }
    const plinthMat = new THREE.MeshStandardMaterial({
      color: base.clone().offsetHSL(0, -0.05, -0.3),
      roughness: 0.97,
    });

    // ExtrudeGeometry material groups: [caps, sides]
    return {
      geometry,
      roofGeometry,
      gableGeo,
      edges,
      materials: [capMat, sideMat],
      roofMat,
      plinthGeo,
      plinthMat,
    };
  }, [
    building,
    textureOverride,
    windowGlow,
    analysis,
    imagery?.texture,
    imagery?.size,
    imagery?.detail?.texture,
    imagery?.detail?.size,
  ]);

  return (
    <group>
      <mesh
        geometry={geometry}
        material={materials}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          setActiveBuilding(isActive ? null : building.id);
        }}
      />
      {/* roof: gabled prism for houses, flat slab otherwise */}
      {gableGeo ? (
        <mesh geometry={gableGeo} material={roofMat} castShadow />
      ) : (
        <mesh
          geometry={roofGeometry}
          material={roofMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, building.height + 0.02, 0]}
        />
      )}
      {/* plinth band at the base */}
      <mesh
        geometry={plinthGeo}
        material={plinthMat}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
      {/* entrances with canopies and lamps */}
      <Entrances building={building} night={1 - daylight} isFree={isFree} />
      {/* street furniture reconstructed from the photo analysis */}
      {analysis && (
        <StreetFurniture
          building={building}
          street={analysis.street}
          isFree={isFree}
        />
      )}
      <lineSegments geometry={edges} rotation={[-Math.PI / 2, 0, 0]}>
        <lineBasicMaterial
          color={isActive ? "#34d399" : "#0e1513"}
          transparent
          opacity={isActive ? 0.95 : 0.35}
        />
      </lineSegments>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Roads as flat ribbons                                               */
/* ------------------------------------------------------------------ */

function ribbonGeometry(path: [number, number][], width: number) {
  const half = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  const n = path.length;

  for (let i = 0; i < n; i++) {
    const [x, z] = path[i];
    const [px, pz] = path[Math.max(0, i - 1)];
    const [nx, nz] = path[Math.min(n - 1, i + 1)];
    let dx = nx - px;
    let dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // perpendicular in XZ
    const ox = -dz * half;
    const oz = dx * half;
    positions.push(x + ox, 0, z + oz, x - ox, 0, z - oz);
    if (i < n - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const normals = new Float32Array((positions.length / 3) * 3);
  for (let i = 0; i < normals.length; i += 3) normals[i + 1] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geo;
}

function RoadRibbon({ road }: { road: OsmRoad }) {
  const isFoot = /footway|path|steps|cycleway|pedestrian/.test(road.kind);
  const { geometry, sidewalkGeometry } = useMemo(
    () => ({
      geometry: ribbonGeometry(road.path, road.width),
      // carriageways get a slightly lighter sidewalk band on both sides
      sidewalkGeometry: isFoot ? null : ribbonGeometry(road.path, road.width + 3),
    }),
    [road, isFoot]
  );
  return (
    <group>
      {sidewalkGeometry && (
        <mesh geometry={sidewalkGeometry} position={[0, 0.015, 0]} receiveShadow>
          <meshStandardMaterial
            color="#272d2b"
            roughness={0.98}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}
      <mesh geometry={geometry} position={[0, isFoot ? 0.03 : 0.022, 0]} receiveShadow>
        <meshStandardMaterial
          color={isFoot ? "#2f3532" : "#191d1d"}
          roughness={0.92}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Railways: ballast bed + two metallic rails                          */
/* ------------------------------------------------------------------ */

function offsetPath(
  path: [number, number][],
  offset: number
): [number, number][] {
  const n = path.length;
  return path.map(([x, z], i) => {
    const [px, pz] = path[Math.max(0, i - 1)];
    const [nx, nz] = path[Math.min(n - 1, i + 1)];
    let dx = nx - px;
    let dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    return [x - dz * offset, z + dx * offset];
  });
}

function RailwayLine({ rail }: { rail: OsmRail }) {
  const isTram = rail.kind === "tram" || rail.kind === "light_rail";
  const { ballast, railL, railR } = useMemo(
    () => ({
      ballast: ribbonGeometry(rail.path, isTram ? 2.6 : 3.6),
      railL: ribbonGeometry(offsetPath(rail.path, -0.76), 0.12),
      railR: ribbonGeometry(offsetPath(rail.path, 0.76), 0.12),
    }),
    [rail, isTram]
  );
  return (
    <group>
      {!isTram && (
        <mesh geometry={ballast} position={[0, 0.05, 0]} receiveShadow>
          <meshStandardMaterial color="#1e1d1b" roughness={1} />
        </mesh>
      )}
      {[railL, railR].map((g, i) => (
        <mesh key={i} geometry={g} position={[0, isTram ? 0.035 : 0.11, 0]}>
          <meshStandardMaterial
            color="#a7adb3"
            metalness={0.9}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Vegetation scattered inside parks / woods / meadows                 */
/* ------------------------------------------------------------------ */

function pointInPolygon(x: number, z: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonArea(poly: [number, number][]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

const MAX_SCATTERED = 120;

function ScatteredVegetation({
  areas,
  isFree,
}: {
  areas: OsmArea[];
  isFree: IsFree;
}) {
  const spots = useMemo(() => {
    const out: { id: number; position: [number, number] }[] = [];
    for (const area of areas) {
      if (area.kind !== "green") continue;
      const xs = area.polygon.map((p) => p[0]);
      const zs = area.polygon.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const rand = seededRandom(area.id * 0.031);
      // Even grid with jitter (no clumps), each cell validated against
      // buildings and roads so trees never spawn through structures.
      const cell = 7;
      let placed = 0;
      for (let gx = minX + cell / 2; gx < maxX; gx += cell) {
        for (let gz = minZ + cell / 2; gz < maxZ; gz += cell) {
          const x = gx + (rand() - 0.5) * cell * 0.6;
          const z = gz + (rand() - 0.5) * cell * 0.6;
          if (!pointInPolygon(x, z, area.polygon)) continue;
          if (!isFree(x, z, 1.2)) continue;
          out.push({ id: area.id * 1000 + placed, position: [x, z] });
          placed++;
          if (out.length >= MAX_SCATTERED) return out;
        }
      }
    }
    return out;
  }, [areas, isFree]);

  return (
    <group>
      {spots.map((s) => (
        <StreetTree key={s.id} tree={s} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Street lamps scattered along carriageways (emissive; bloom glows)   */
/* ------------------------------------------------------------------ */

const LAMP_SPACING = 26;
const MAX_LAMPS = 48;

function buildLampPositions(roads: OsmRoad[]): [number, number][] {
  const positions: [number, number][] = [];
  for (const road of roads) {
    if (/footway|path|steps|cycleway|service/.test(road.kind)) continue;
    const offset = road.width / 2 + 1.2;
    let walked = LAMP_SPACING * 0.5;
    for (let i = 0; i < road.path.length - 1; i++) {
      const [x1, z1] = road.path[i];
      const [x2, z2] = road.path[i + 1];
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      if (segLen < 0.01) continue;
      const dx = (x2 - x1) / segLen;
      const dz = (z2 - z1) / segLen;
      while (walked < segLen) {
        const side = positions.length % 2 === 0 ? 1 : -1;
        positions.push([
          x1 + dx * walked - dz * offset * side,
          z1 + dz * walked + dx * offset * side,
        ]);
        if (positions.length >= MAX_LAMPS) return positions;
        walked += LAMP_SPACING;
      }
      walked -= segLen;
    }
  }
  return positions;
}

function StreetLamps({ roads, isFree }: { roads: OsmRoad[]; isFree: IsFree }) {
  const positions = useMemo(
    () => buildLampPositions(roads).filter(([x, z]) => isFree(x, z, 0)),
    [roads, isFree]
  );
  const timeOfDay = useStore((s) => s.timeOfDay);
  // lamps come on as the sun goes down
  const night = 1 - sunAt(timeOfDay).daylight;
  return (
    <group>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 2.1, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 4.2, 6]} />
            <meshStandardMaterial color="#2b3236" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 4.25, 0]}>
            <sphereGeometry args={[0.17, 10, 10]} />
            <meshStandardMaterial
              color="#ffe6b0"
              emissive="#ffb954"
              emissiveIntensity={0.15 + 3.1 * night}
              toneMapped={false}
            />
          </mesh>
          {/* warm light pool on the pavement */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <circleGeometry args={[2.6, 20]} />
            <meshBasicMaterial
              color="#ffb954"
              transparent
              opacity={0.075 * night}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Green / water areas                                                 */
/* ------------------------------------------------------------------ */

function areaGeometry(polygon: [number, number][]) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function AreaPatch({ area }: { area: OsmArea }) {
  const geometry = useMemo(() => areaGeometry(area.polygon), [area]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <meshStandardMaterial
        color={area.kind === "water" ? "#0d2a3d" : "#12301f"}
        roughness={area.kind === "water" ? 0.25 : 1}
        metalness={area.kind === "water" ? 0.3 : 0}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/** ArcGIS-Urban-style land-use zoning overlay. */
function ZonePatch({ area }: { area: OsmArea }) {
  const geometry = useMemo(() => areaGeometry(area.polygon), [area]);
  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.14, 0]}
      renderOrder={2}
    >
      <meshBasicMaterial
        color={ZONE_COLORS[area.kind]}
        transparent
        opacity={0.13}
        depthWrite={false}
        depthTest
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Street trees                                                        */
/* ------------------------------------------------------------------ */

function StreetTree({ tree }: { tree: OsmTree }) {
  const { scale, variant, crown, crown2 } = useMemo(() => {
    const rand = seededRandom(tree.id * 0.117);
    const crown = new THREE.Color("#1d4a2b").offsetHSL(
      (rand() - 0.5) * 0.06,
      (rand() - 0.5) * 0.15,
      (rand() - 0.5) * 0.08
    );
    return {
      scale: 0.7 + rand() * 0.9,
      variant: tree.id % 3,
      crown,
      crown2: crown.clone().offsetHSL(0, 0, 0.05),
    };
  }, [tree.id]);

  return (
    <group position={[tree.position[0], 0, tree.position[1]]} scale={scale}>
      {variant !== 2 && (
        <mesh castShadow position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.09, 0.15, 1.8, 6]} />
          <meshStandardMaterial color="#4a341f" roughness={0.95} />
        </mesh>
      )}
      {variant === 0 && (
        // deciduous: two-lobe crown
        <>
          <mesh castShadow position={[0, 2.5, 0]}>
            <sphereGeometry args={[1.15, 8, 6]} />
            <meshStandardMaterial color={crown} roughness={0.95} flatShading />
          </mesh>
          <mesh castShadow position={[0.5, 3.1, 0.3]}>
            <sphereGeometry args={[0.7, 7, 5]} />
            <meshStandardMaterial color={crown2} roughness={0.95} flatShading />
          </mesh>
        </>
      )}
      {variant === 1 && (
        // conifer: stacked cones
        <>
          <mesh castShadow position={[0, 2.2, 0]}>
            <coneGeometry args={[1.05, 2.2, 7]} />
            <meshStandardMaterial color={crown} roughness={0.95} flatShading />
          </mesh>
          <mesh castShadow position={[0, 3.5, 0]}>
            <coneGeometry args={[0.7, 1.6, 7]} />
            <meshStandardMaterial color={crown2} roughness={0.95} flatShading />
          </mesh>
        </>
      )}
      {variant === 2 && (
        // low bush
        <mesh castShadow position={[0, 0.55, 0]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.9, 7, 5]} />
          <meshStandardMaterial color={crown} roughness={0.95} flatShading />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */

function groundQuad(meters: number) {
  const h = meters / 2;
  // same (x, -z) shape-coordinate convention as roofs -> shared mapping
  const shape = new THREE.Shape([
    new THREE.Vector2(-h, -h),
    new THREE.Vector2(h, -h),
    new THREE.Vector2(h, h),
    new THREE.Vector2(-h, h),
  ]);
  return new THREE.ShapeGeometry(shape);
}

/** Wide orthophoto, plus a sharper center patch when resolution enhancement is on. */
function SatelliteGround({ imagery }: { imagery: GroundImagery }) {
  const wide = useMemo(() => groundQuad(imagery.size), [imagery.size]);
  const detailGeo = useMemo(
    () => (imagery.detail ? groundQuad(imagery.detail.size) : null),
    [imagery.detail]
  );

  return (
    <group>
      <mesh
        geometry={wide}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        renderOrder={-2}
      >
        <meshBasicMaterial
          map={imagery.texture}
          depthWrite
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {imagery.detail && detailGeo && (
        <mesh
          geometry={detailGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.04, 0]}
          renderOrder={-1}
        >
          <meshBasicMaterial
            map={imagery.detail.texture}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}
    </group>
  );
}

export default function SurroundingsView({ data }: { data: Surroundings }) {
  const showZoning = useStore((s) => s.showZoning);
  const showSatellite = useStore((s) => s.showSatellite);
  const selected = useStore((s) => s.selected);
  // One placement validator shared by everything that spawns on the ground
  const isFree = useMemo(() => buildPlacementChecker(data), [data]);
  // OSM point trees can also clip buildings (mapping inaccuracies)
  const validTrees = useMemo(
    () => data.trees.filter((t) => isFree(t.position[0], t.position[1], 0)),
    [data.trees, isFree]
  );

  // Real satellite orthophoto for ground + roofs
  const [imagery, setImagery] = useState<GroundImagery | null>(null);
  const [rawImagery, setRawImagery] = useState<GroundImagery | null>(null);
  const detailTex = useRef<THREE.Texture | null>(null);
  const showImagery = (next: GroundImagery | null) => {
    const keep = next?.detail?.texture ?? null;
    if (detailTex.current && detailTex.current !== keep) detailTex.current.dispose();
    detailTex.current = keep;
    setImagery(next);
  };
  const enhanceSatellite = useStore((s) => s.enhanceSatellite);
  const setSatelliteStatus = useStore((s) => s.setSatelliteStatus);
  useEffect(() => {
    let stale = false;
    if (!selected) {
      setRawImagery(null);
      showImagery(null);
      setSatelliteStatus("idle");
      return;
    }
    setRawImagery(null);
    showImagery(null);
    setSatelliteStatus("loading", "Собираю снимок…");
    (async () => {
      const raw = await loadGroundImagery(selected.lng, selected.lat);
      if (stale) return;
      if (!raw) {
        setRawImagery(null);
        showImagery(null);
        setSatelliteStatus("failed", "Снимок не загрузился");
        return;
      }
      setRawImagery(raw);
    })();
    return () => {
      stale = true;
    };
  }, [selected, setSatelliteStatus]);

  useEffect(() => {
    if (!selected || !rawImagery) return;
    if (!enhanceSatellite) {
      showImagery(rawImagery);
      setSatelliteStatus("ready", "Спутник без улучшения");
      return;
    }
    const controller = new AbortController();
    let stale = false;
    showImagery(rawImagery);
    setSatelliteStatus("enhancing", "Повышаю разрешение центра…");
    (async () => {
      try {
        const better = await enhanceGroundImagery(rawImagery, {
          signal: controller.signal,
          cacheKey: `${selected.lng.toFixed(5)},${selected.lat.toFixed(5)}`,
        });
        if (stale) {
          better.detail?.texture.dispose();
          return;
        }
        const px =
          better.detail?.texture.image instanceof HTMLCanvasElement
            ? better.detail.texture.image.width
            : 0;
        const cm = better.detail && px > 0 ? (better.detail.size / px) * 100 : 0;
        showImagery(better);
        setSatelliteStatus(
          "ready",
          cm > 0
            ? `Центр площадки ${cm.toFixed(1)} см/пиксель`
            : "Разрешение центра повышено"
        );
      } catch {
        if (!stale) {
          showImagery(rawImagery);
          setSatelliteStatus("ready", "Спутник без улучшения");
        }
      }
    })();
    return () => {
      stale = true;
      controller.abort();
    };
  }, [selected, rawImagery, enhanceSatellite, setSatelliteStatus]);

  const satActive = showSatellite && imagery !== null;

  return (
    <group>
      {satActive && imagery && <SatelliteGround imagery={imagery} />}
      {/* painted ground cover only when the real photo is off/unavailable */}
      {!satActive &&
        data.areas
          .filter((a) => !a.zoning)
          .map((a) => <AreaPatch key={`a-${a.id}`} area={a} />)}
      {showZoning &&
        data.areas
          .filter((a) => a.zoning)
          .map((a) => <ZonePatch key={`z-${a.id}`} area={a} />)}
      {!satActive &&
        data.roads.map((r) => <RoadRibbon key={`r-${r.id}`} road={r} />)}
      {data.rails.map((r) => (
        <RailwayLine key={`rw-${r.id}`} rail={r} />
      ))}
      {data.buildings.map((b) => (
        <RealBuilding
          key={`b-${b.id}`}
          building={b}
          isFree={isFree}
          imagery={satActive ? imagery : null}
        />
      ))}
      {validTrees.map((t) => (
        <StreetTree key={`t-${t.id}`} tree={t} />
      ))}
      <ScatteredVegetation areas={data.areas} isFree={isFree} />
      <StreetLamps roads={data.roads} isFree={isFree} />
    </group>
  );
}
