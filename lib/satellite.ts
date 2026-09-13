/**
 * 4K nadir orthophoto for the 3D ground and roofs.
 * Stitches z20/z19 satellite tiles (Google first at high zoom) into a 4096²
 * canvas — real pixels, not bicubic soap.
 */

import * as THREE from "three";

const TILE_URL = (z: number, x: number, y: number) =>
  `/api/sat-tile?z=${z}&x=${x}&y=${y}`;

/** Target texture edge in pixels. */
const TARGET_PX = 4096;
const TILE_PX = 256;

export interface GroundImagery {
  texture: THREE.CanvasTexture;
  /** Side length of the covered square, meters. */
  size: number;
  enhanced?: boolean;
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TILE_URL(z, x, y);
  });
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** World-coord mapping shared by the ground quad and roof materials. */
export function applyGroundMapping(t: THREE.Texture, size: number) {
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.repeat.set(1 / size, 1 / size);
  t.offset.set(0.5, 0.5);
  return t;
}

function lanczos(x: number, a = 3) {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= a) return 0;
  const pix = Math.PI * x;
  return (a * Math.sin(pix) * Math.sin(pix / a)) / (pix * pix);
}

/** Separable Lanczos-3 resample — keeps edges readable when we must 2× a 2K stitch. */
function resampleLanczos(
  src: HTMLCanvasElement,
  dw: number,
  dh: number
): HTMLCanvasElement {
  const sw = src.width;
  const sh = src.height;
  const sctx = src.getContext("2d")!;
  const srcData = sctx.getImageData(0, 0, sw, sh).data;
  const a = 3;

  const tmp = new Float32Array(dw * sh * 4);
  const scaleX = sw / dw;
  for (let x = 0; x < dw; x++) {
    const srcX = (x + 0.5) * scaleX - 0.5;
    const xBase = Math.floor(srcX);
    for (let y = 0; y < sh; y++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let k = xBase - a + 1; k <= xBase + a; k++) {
        const ck = Math.max(0, Math.min(sw - 1, k));
        const w = lanczos(srcX - k, a);
        const i = (y * sw + ck) * 4;
        r += srcData[i] * w;
        g += srcData[i + 1] * w;
        b += srcData[i + 2] * w;
        wsum += w;
      }
      const o = (y * dw + x) * 4;
      const inv = wsum || 1;
      tmp[o] = r / inv;
      tmp[o + 1] = g / inv;
      tmp[o + 2] = b / inv;
      tmp[o + 3] = 255;
    }
  }

  const out = document.createElement("canvas");
  out.width = dw;
  out.height = dh;
  const octx = out.getContext("2d")!;
  const dst = octx.createImageData(dw, dh);
  const d = dst.data;
  const scaleY = sh / dh;
  for (let y = 0; y < dh; y++) {
    const srcY = (y + 0.5) * scaleY - 0.5;
    const yBase = Math.floor(srcY);
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let k = yBase - a + 1; k <= yBase + a; k++) {
        const ck = Math.max(0, Math.min(sh - 1, k));
        const w = lanczos(srcY - k, a);
        const i = (ck * dw + x) * 4;
        r += tmp[i] * w;
        g += tmp[i + 1] * w;
        b += tmp[i + 2] * w;
        wsum += w;
      }
      const o = (y * dw + x) * 4;
      const inv = wsum || 1;
      d[o] = Math.max(0, Math.min(255, r / inv));
      d[o + 1] = Math.max(0, Math.min(255, g / inv));
      d[o + 2] = Math.max(0, Math.min(255, b / inv));
      d[o + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

function toTexture(canvas: HTMLCanvasElement, size: number, enhanced: boolean): GroundImagery {
  const texture = new THREE.CanvasTexture(canvas);
  applyGroundMapping(texture, size);
  return { texture, size, enhanced };
}

async function stitchTiles(
  lng: number,
  lat: number,
  zoom: number,
  gridTiles: number
): Promise<{ canvas: HTMLCanvasElement; size: number; loaded: number } | null> {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * TILE_PX;
  const py =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n *
    TILE_PX;

  const half = (gridTiles * TILE_PX) / 2;
  const x0 = Math.floor((px - half) / TILE_PX);
  const y0 = Math.floor((py - half) / TILE_PX);
  const shiftX = px - half - x0 * TILE_PX;
  const shiftY = py - half - y0 * TILE_PX;

  const canvasSize = gridTiles * TILE_PX;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a1210";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const jobs: { dx: number; dy: number }[] = [];
  for (let dx = 0; dx <= gridTiles; dx++) {
    for (let dy = 0; dy <= gridTiles; dy++) {
      jobs.push({ dx, dy });
    }
  }

  let loaded = 0;
  await pool(jobs, 12, async ({ dx, dy }) => {
    const img = await loadTile(zoom, x0 + dx, y0 + dy);
    if (!img) return;
    loaded++;
    ctx.drawImage(img, dx * TILE_PX - shiftX, dy * TILE_PX - shiftY);
  });

  if (loaded === 0) return null;
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / n;
  return { canvas, size: canvasSize * metersPerPixel, loaded };
}

export async function loadGroundImagery(
  lng: number,
  lat: number
): Promise<GroundImagery | null> {
  // 16*256 = 4096. z20 ≈ 0.1 m/px at Taganrog → ~410 m square.
  const hi = await stitchTiles(lng, lat, 20, 16);
  if (hi && hi.loaded >= 80) {
    return toTexture(hi.canvas, hi.size, false);
  }
  const mid = await stitchTiles(lng, lat, 19, 16);
  if (mid && mid.loaded >= 80) {
    return toTexture(mid.canvas, mid.size, false);
  }
  const lo =
    (await stitchTiles(lng, lat, 19, 8)) ??
    (await stitchTiles(lng, lat, 18, 8)) ??
    (hi && hi.loaded > 0 ? hi : null) ??
    (mid && mid.loaded > 0 ? mid : null);
  if (!lo) return null;
  return toTexture(lo.canvas, lo.size, false);
}

function sourceToCanvas(image: unknown): HTMLCanvasElement | null {
  if (image instanceof HTMLCanvasElement) return image;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    c.getContext("2d")!.drawImage(image, 0, 0);
    return c;
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    const c = document.createElement("canvas");
    c.width = image.naturalWidth || image.width;
    c.height = image.naturalHeight || image.height;
    c.getContext("2d")!.drawImage(image, 0, 0);
    return c;
  }
  return null;
}

/** Scale the stitch to 4096² with Lanczos so the scene gets a real 4K backdrop. */
export async function enhanceGroundImagery(
  imagery: GroundImagery
): Promise<GroundImagery> {
  const source = sourceToCanvas(imagery.texture.image);
  if (!source) return imagery;

  await new Promise((r) => setTimeout(r, 0));
  const canvas =
    source.width >= TARGET_PX && source.height >= TARGET_PX
      ? source
      : resampleLanczos(source, TARGET_PX, TARGET_PX);

  const texture = new THREE.CanvasTexture(canvas);
  applyGroundMapping(texture, imagery.size);
  return { texture, size: imagery.size, enhanced: true };
}
