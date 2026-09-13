/** ArcGIS-Urban-style capacity metrics: floor area, residents, jobs, FAR. */

import type { PlacedObject } from "./store";
import type { Surroundings } from "@/services/osm";
import { SANDBOX_SIZE } from "./constants";

export const BLOCK_FOOT_W = 6;
export const BLOCK_FOOT_D = 8;
export const BLOCK_STOREY = 3.2;
/** USD per m² of new gross floor area (rough RF regional build cost). */
export const BLOCK_RATE = 400;

const M2_PER_RESIDENT = 35;
const M2_PER_JOB = 20;

const RESIDENTIAL_KINDS = /^(apartments|house|detached|residential|terrace|dormitory|bungalow|yes)$/;
const JOB_KINDS = /^(commercial|retail|office|industrial|warehouse|supermarket|kiosk|school|university|hospital|public)$/;

function polygonArea(poly: [number, number][]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

export interface ScenarioMetrics {
  proposedGFA: number;
  residents: number;
  jobs: number;
  investment: number;
  /** Proposed floor area over the planning sandbox site. */
  far: number;
}

export interface ContextMetrics {
  contextGFA: number;
  contextResidents: number;
  contextJobs: number;
  buildings: number;
}

export function blockGFA(o: PlacedObject) {
  return BLOCK_FOOT_W * BLOCK_FOOT_D * (o.floors ?? 1);
}

export function computeScenarioMetrics(objects: PlacedObject[]): ScenarioMetrics {
  let gfaRes = 0;
  let gfaJobs = 0;
  let investment = 0;
  for (const o of objects) {
    investment += o.price;
    if (o.kind !== "block") continue;
    const gfa = blockGFA(o);
    if (o.use === "commercial") gfaJobs += gfa;
    else if (o.use === "mixed") {
      gfaRes += gfa * 0.6;
      gfaJobs += gfa * 0.4;
    } else gfaRes += gfa;
  }
  const proposedGFA = gfaRes + gfaJobs;
  return {
    proposedGFA,
    residents: Math.round(gfaRes / M2_PER_RESIDENT),
    jobs: Math.round(gfaJobs / M2_PER_JOB),
    investment,
    far: proposedGFA / (SANDBOX_SIZE * SANDBOX_SIZE),
  };
}

export function computeContextMetrics(
  surroundings: Surroundings | null
): ContextMetrics {
  if (!surroundings) {
    return { contextGFA: 0, contextResidents: 0, contextJobs: 0, buildings: 0 };
  }
  let gfa = 0;
  let res = 0;
  let jobs = 0;
  for (const b of surroundings.buildings) {
    const area = polygonArea(b.footprint);
    const floorArea = area * b.levels;
    gfa += floorArea;
    if (JOB_KINDS.test(b.kind)) jobs += floorArea / M2_PER_JOB;
    else if (RESIDENTIAL_KINDS.test(b.kind)) res += floorArea / M2_PER_RESIDENT;
  }
  return {
    contextGFA: Math.round(gfa),
    contextResidents: Math.round(res),
    contextJobs: Math.round(jobs),
    buildings: surroundings.buildings.length,
  };
}
