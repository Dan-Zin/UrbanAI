/**
 * Real-world surroundings from OpenStreetMap (Overpass API).
 *
 * Fetches building footprints, roads, trees and green/water areas around a
 * clicked coordinate and converts them into local meters (sandbox space,
 * X = east, Z = south, origin at the clicked point).
 *
 * Endpoint order matters: the VK/mail.ru mirror is the most reliable from
 * Russian networks; the others are fallbacks.
 */

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

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
  type: "way" | "node";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
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

export async function fetchSurroundings(
  lng: number,
  lat: number,
  radius = 85
): Promise<Surroundings | null> {
  const query = `[out:json][timeout:20];
(
  way["building"](around:${radius},${lat},${lng});
  way["highway"](around:${radius},${lat},${lng});
  way["railway"~"^(rail|tram|light_rail|narrow_gauge)$"](around:${radius},${lat},${lng});
  node["natural"="tree"](around:${radius},${lat},${lng});
  way["natural"="tree_row"](around:${radius},${lat},${lng});
  way["leisure"~"^(park|garden|playground|pitch)$"](around:${radius},${lat},${lng});
  way["landuse"~"^(grass|forest|meadow|orchard)$"](around:${radius},${lat},${lng});
  way["landuse"~"^(residential|commercial|industrial|retail|education)$"](around:${radius},${lat},${lng});
  way["amenity"~"^(school|university|college)$"](around:${radius},${lat},${lng});
  way["natural"~"^(wood|scrub|grassland)$"](around:${radius},${lat},${lng});
  way["natural"="water"](around:${radius},${lat},${lng});
  way["waterway"="riverbank"](around:${radius},${lat},${lng});
);
out geom;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      if (!json.elements) continue;
      return parseElements(json.elements, lng, lat);
    } catch {
      continue; // try next mirror
    }
  }
  return null;
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

    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const pts = el.geometry.map((g) => toLocal(g.lat, g.lon));

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
        id: el.id,
        footprint,
        height,
        levels,
        kind: tags["building"],
        name: tags["name"] ?? tags["addr:street"],
        colour: tags["building:colour"],
        roofColour: tags["roof:colour"],
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
      for (let i = 0; i < pts.length - 1 && surroundings.trees.length < 200; i++) {
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

  // Keep the scene manageable
  surroundings.buildings = surroundings.buildings.slice(0, 160);
  surroundings.roads = surroundings.roads.slice(0, 120);
  surroundings.rails = surroundings.rails.slice(0, 24);
  surroundings.trees = surroundings.trees.slice(0, 200);
  surroundings.areas = surroundings.areas.slice(0, 60);
  return surroundings;
}
