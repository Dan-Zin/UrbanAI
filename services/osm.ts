/**
 * Real-world surroundings from OpenStreetMap (Overpass API).
 *
 * Fetches building footprints, roads, trees and green/water areas around a
 * clicked coordinate and converts them into local meters (sandbox space,
 * X = east, Z = south, origin at the clicked point).
 *
 * Overpass rejects clients that send no User-Agent (HTTP 406). Node's fetch
 * sends none, so the public mirrors must get an explicit one. The German
 * endpoints answer in a few seconds once that header is set; maps.mail.ru is
 * the fallback when those are blocked.
 */

import { OSM_RADIUS_M } from "@/lib/constants";

const OVERPASS_USER_AGENT = "TochkaRosta/1.0 (Taganrog urban studio)";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/** OSM building:colour is often a Russian word THREE.js cannot parse. */
const OSM_COLOR_NAMES: Record<string, string> = {
  red: "#c0392b",
  красный: "#c0392b",
  красная: "#c0392b",
  красное: "#c0392b",
  бордовый: "#7b1e3a",
  вишнёвый: "#7a1f2b",
  вишневый: "#7a1f2b",
  малиновый: "#b03050",
  коричневый: "#8b5a2b",
  brown: "#8b5a2b",
  бежевый: "#d9c3a0",
  beige: "#d9c3a0",
  жёлтый: "#d4a017",
  желтый: "#d4a017",
  yellow: "#d4a017",
  золотой: "#c9a227",
  оранжевый: "#d9762c",
  orange: "#d9762c",
  зелёный: "#4a7c3f",
  зеленый: "#4a7c3f",
  green: "#4a7c3f",
  салатовый: "#9cba4f",
  оливковый: "#6e7a3a",
  голубой: "#6ba3c7",
  синий: "#2c5aa0",
  blue: "#2c5aa0",
  фиолетовый: "#6b3fa0",
  сиреневый: "#b59ac7",
  розовый: "#d48aa0",
  pink: "#d48aa0",
  белый: "#e8e4dc",
  white: "#e8e4dc",
  серый: "#9a958c",
  серая: "#9a958c",
  grey: "#9a958c",
  gray: "#9a958c",
  чёрный: "#1a1a1a",
  черный: "#1a1a1a",
  black: "#1a1a1a",
  кирпичный: "#b5523a",
  песочный: "#cbb07a",
  кремовый: "#efe6d0",
  охра: "#c4a35a",
  охристый: "#c4a35a",
  терракотовый: "#c46a4a",
  шоколадный: "#5c3a24",
  молочный: "#f0ead8",
  бирюзовый: "#3aa6a1",
  хаки: "#8a8f4e",
  горчичный: "#b8962e",
  медный: "#b87333",
  персиковый: "#e0a882",
  коралловый: "#d07060",
  ivory: "#eee8d5",
  silver: "#b8b8b8",
  серебристый: "#b8b8b8",
};

export function normalizeOsmColor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(/[;,/]/)[0].trim().toLowerCase().replace(/ё/g, "е");
  if (!first) return undefined;
  if (/^#?[0-9a-f]{6}$/.test(first)) {
    return first.startsWith("#") ? first : `#${first}`;
  }
  if (/^#?[0-9a-f]{3}$/.test(first)) {
    const h = first.startsWith("#") ? first.slice(1) : first;
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  const rgb = first.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  if (OSM_COLOR_NAMES[first]) return OSM_COLOR_NAMES[first];
  const stripped = first.replace(/^(темно|тёмно|светло)[-\s]+/, "");
  if (stripped !== first && OSM_COLOR_NAMES[stripped]) {
    return OSM_COLOR_NAMES[stripped];
  }
  return undefined;
}

export interface OsmBuilding {
  id: number;
  /** Closed footprint in local meters [x, z][], first point NOT repeated. */
  footprint: [number, number][];
  height: number;
  levels: number;
  kind: string;
  name?: string;
  /** Real facade colour from OSM building:colour, when mapped. */
  colour?: string;
  roofColour?: string;
  roofShape?: string;
  /** Real facade material from OSM building:material, when mapped. */
  material?: string;
}

export interface OsmRail {
  id: number;
  path: [number, number][];
  kind: string; // rail | tram | light_rail | narrow_gauge
}

export interface OsmRoad {
  id: number;
  path: [number, number][];
  width: number;
  kind: string;
}

export type ZoneKind =
  | "green"
  | "water"
  | "residential"
  | "commercial"
  | "industrial"
  | "retail"
  | "education";

export interface OsmArea {
  id: number;
  polygon: [number, number][];
  kind: ZoneKind;
  /** true for land-use zoning overlays (vs physical green/water cover) */
  zoning?: boolean;
}

export interface OsmTree {
  id: number;
  position: [number, number];
}

export interface Surroundings {
  buildings: OsmBuilding[];
  roads: OsmRoad[];
  rails: OsmRail[];
  areas: OsmArea[];
  trees: OsmTree[];
}

interface OverpassElement {
  type: "way" | "node" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    ref: number;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

const ROAD_WIDTHS: Record<string, number> = {
  motorway: 9,
  trunk: 9,
  primary: 8,
  secondary: 7,
  tertiary: 6,
  residential: 5,
  unclassified: 4.5,
  service: 3.5,
  living_street: 4,
  pedestrian: 3.5,
  footway: 1.8,
  path: 1.5,
  cycleway: 2,
  steps: 1.5,
};

/** Estimated storey height in meters. */
const STOREY = 3.2;

function estimateHeight(tags: Record<string, string>, id: number): { height: number; levels: number } {
  const explicit = parseFloat(tags["height"] ?? tags["building:height"] ?? "");
  if (!Number.isNaN(explicit) && explicit > 0) {
    return { height: explicit, levels: Math.max(1, Math.round(explicit / STOREY)) };
  }
  const levels = parseInt(tags["building:levels"] ?? "", 10);
  if (!Number.isNaN(levels) && levels > 0) {
    return { height: levels * STOREY + 0.8, levels };
  }
  // Sensible defaults per building type, with a deterministic wobble by id
  const kind = tags["building"];
  const wobble = (id % 7) * 0.4;
  if (kind === "garage" || kind === "garages" || kind === "shed") {
    return { height: 2.8, levels: 1 };
  }
  if (kind === "house" || kind === "detached" || kind === "residential") {
    return { height: 5 + wobble, levels: 2 };
  }
  if (kind === "apartments") {
    return { height: 15 + wobble * 2, levels: 5 };
  }
  return { height: 7 + wobble, levels: 2 };
}

function bboxOf(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return `${lat - dLat},${lng - dLng},${lat + dLat},${lng + dLng}`;
}

async function postOverpass(
  endpoint: string,
  query: string,
  timeoutMs: number
): Promise<OverpassElement[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: "data=" + encodeURIComponent(query),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return json.elements?.length ? json.elements : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function firstOverpass(
  query: string,
  timeoutMs: number
): Promise<OverpassElement[] | null> {
  for (const ep of OVERPASS_ENDPOINTS) {
    const els = await postOverpass(ep, query, timeoutMs);
    if (els) return els;
  }
  return null;
}

export async function querySurroundings(
  lng: number,
  lat: number,
  radius = OSM_RADIUS_M
): Promise<Surroundings | null> {
  const bbox = bboxOf(lat, lng, radius);
  const buildingsQ = `[out:json][timeout:25];(way["building"](${bbox}););out geom;`;
  const contextQ = `[out:json][timeout:25];(
  way["highway"](${bbox});
  way["railway"~"^(rail|tram|light_rail|narrow_gauge)$"](${bbox});
  node["natural"="tree"](${bbox});
  way["leisure"~"^(park|garden|playground)$"](${bbox});
  way["landuse"~"^(grass|forest|meadow|residential|commercial|industrial|retail)$"](${bbox});
  way["natural"="water"](${bbox});
);out geom;`;

  // Buildings and streets are independent queries. Run them together so a
  // slow mirror does not eat the whole budget before roads are requested.
  const [buildingEls, contextEls] = await Promise.all([
    firstOverpass(buildingsQ, 25000),
    firstOverpass(contextQ, 25000),
  ]);

  let buildings = buildingEls;
  if (!buildings) {
    const small = bboxOf(lat, lng, Math.min(100, radius));
    buildings = await firstOverpass(
      `[out:json][timeout:20];(way["building"](${small}););out geom;`,
      22000
    );
  }

  if (!buildings && !contextEls) return null;
  const parsed = parseElements([...(buildings ?? []), ...(contextEls ?? [])], lng, lat);
  if (parsed.roads.length === 0) {
    const highwayEls = await firstOverpass(
      `[out:json][timeout:20];(way["highway"](${bbox}););out geom;`,
      22000
    );
    if (highwayEls) {
      parsed.roads = parseElements(highwayEls, lng, lat).roads;
    }
  }
  return parsed;
}

export async function fetchSurroundings(
  lng: number,
  lat: number,
  radius = OSM_RADIUS_M
): Promise<Surroundings | null> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/overpass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lng, lat, radius }),
      });
      if (res.ok) {
        const data = (await res.json()) as Surroundings;
        if (data?.buildings || data?.roads) return data;
      }
    } catch {
      /* fall through to direct mirrors */
    }
  }
  return querySurroundings(lng, lat, radius);
}

function parseElements(
  elements: OverpassElement[],
  lng0: number,
  lat0: number
): Surroundings {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const toLocal = (lat: number, lon: number): [number, number] => [
    (lon - lng0) * mPerDegLng,
    -(lat - lat0) * mPerDegLat,
  ];

  const surroundings: Surroundings = {
    buildings: [],
    roads: [],
    rails: [],
    areas: [],
    trees: [],
  };

  for (const el of elements) {
    const tags = el.tags ?? {};

    if (el.type === "node" && tags["natural"] === "tree" && el.lat && el.lon) {
      surroundings.trees.push({ id: el.id, position: toLocal(el.lat, el.lon) });
      continue;
    }

    const geom = geometryOf(el);
    if (!geom || geom.length < 2) continue;
    const pts = geom.map((g) => toLocal(g.lat, g.lon));

    if (tags["building"]) {
      let footprint = pts;
      // drop the repeated closing point of closed ways
      const [fx, fz] = footprint[0];
      const [lx, lz] = footprint[footprint.length - 1];
      if (Math.abs(fx - lx) < 0.01 && Math.abs(fz - lz) < 0.01) {
        footprint = footprint.slice(0, -1);
      }
      if (footprint.length < 3) continue;
      const { height, levels } = estimateHeight(tags, el.id);
      surroundings.buildings.push({
        id: el.type === "relation" ? el.id + 1_000_000_000 : el.id,
        footprint,
        height,
        levels,
        kind: tags["building"],
        name: tags["name"] ?? tags["addr:street"],
        colour: normalizeOsmColor(tags["building:colour"]),
        roofColour: normalizeOsmColor(tags["roof:colour"]),
        roofShape: tags["roof:shape"],
        material: tags["building:material"] ?? tags["building:cladding"],
      });
      continue;
    }

    if (tags["railway"]) {
      surroundings.rails.push({ id: el.id, path: pts, kind: tags["railway"] });
      continue;
    }

    if (tags["natural"] === "tree_row") {
      // expand the row into individual trees every ~8 m
      let walked = 0;
      for (let i = 0; i < pts.length - 1 && surroundings.trees.length < 1200; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[i + 1];
        const segLen = Math.hypot(x2 - x1, z2 - z1);
        if (segLen < 0.01) continue;
        while (walked < segLen) {
          const t = walked / segLen;
          surroundings.trees.push({
            id: el.id * 100 + surroundings.trees.length,
            position: [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t],
          });
          walked += 8;
        }
        walked -= segLen;
      }
      continue;
    }

    if (tags["highway"]) {
      surroundings.roads.push({
        id: el.id,
        path: pts,
        width: ROAD_WIDTHS[tags["highway"]] ?? 4,
        kind: tags["highway"],
      });
      continue;
    }

    const isGreen =
      /^(park|garden|playground|pitch)$/.test(tags["leisure"] ?? "") ||
      /^(grass|forest|meadow|orchard)$/.test(tags["landuse"] ?? "") ||
      /^(wood|scrub|grassland)$/.test(tags["natural"] ?? "");
    const isWater =
      tags["natural"] === "water" || tags["waterway"] === "riverbank";
    if ((isGreen || isWater) && pts.length >= 3) {
      surroundings.areas.push({
        id: el.id,
        polygon: pts,
        kind: isWater ? "water" : "green",
      });
      continue;
    }

    // Land-use zoning overlays (ArcGIS-Urban-style colour coding)
    const zoneUse = tags["landuse"];
    const amenity = tags["amenity"];
    let zone: ZoneKind | null = null;
    if (/^(residential|commercial|industrial|retail)$/.test(zoneUse ?? "")) {
      zone = zoneUse as ZoneKind;
    } else if (
      zoneUse === "education" ||
      /^(school|university|college)$/.test(amenity ?? "")
    ) {
      zone = "education";
    }
    if (zone && pts.length >= 3) {
      surroundings.areas.push({
        id: el.id,
        polygon: pts,
        kind: zone,
        zoning: true,
      });
    }
  }

  // Keep roads/trees/areas bounded; load every building in the query radius.
  surroundings.roads = surroundings.roads.slice(0, 400);
  surroundings.rails = surroundings.rails.slice(0, 80);
  surroundings.trees = surroundings.trees.slice(0, 800);
  surroundings.areas = surroundings.areas.slice(0, 200);
  return surroundings;
}

function geometryOf(
  el: OverpassElement
): { lat: number; lon: number }[] | null {
  if (el.type === "way" && el.geometry && el.geometry.length >= 2) {
    return el.geometry;
  }
  if (el.type === "relation" && el.members?.length) {
    const rings = el.members.filter(
      (m) => m.geometry && m.geometry.length >= 3 && (m.role === "outer" || m.role === "")
    );
    const pool = rings.length
      ? rings
      : el.members.filter((m) => m.type === "way" && m.geometry && m.geometry.length >= 3);
    if (!pool.length) return null;
    pool.sort((a, b) => (b.geometry?.length ?? 0) - (a.geometry?.length ?? 0));
    return pool[0].geometry ?? null;
  }
  return null;
}
