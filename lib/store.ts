import { create } from "zustand";
import { seededRandom } from "./utils";
import { fetchSurroundings, type Surroundings } from "@/services/osm";
import type { SceneAnalysis } from "@/services/ai";

export const TAGANROG_CENTER: [number, number] = [38.9265, 47.2123];

export type ObjectKind = "tree" | "bench" | "lamp" | "fountain" | "block" | "ai";
export type BlockUse = "residential" | "commercial" | "mixed";
export type ScenarioId = "A" | "B";

export interface PlacedObject {
  id: string;
  kind: ObjectKind;
  label: string;
  price: number;
  position: [number, number, number];
  /** Parametric development block fields (kind === "block") */
  floors?: number;
  use?: BlockUse;
}

export interface Building {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
}

export interface SentimentResult {
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  topRequests: { label: string; count: number }[];
  summary: string;
}

export type ComplianceStatus = "idle" | "checking" | "clear" | "warning";

export interface ComplianceResult {
  status: ComplianceStatus;
  message: string;
  layers: { name: string; ok: boolean }[];
}

export const CATALOG: Record<
  Exclude<ObjectKind, "ai">,
  { label: string; price: number }
> = {
  tree: { label: "Tree", price: 200 },
  bench: { label: "Bench", price: 500 },
  lamp: { label: "Street Lamp", price: 350 },
  fountain: { label: "Fountain", price: 4200 },
  block: { label: "Dev Block", price: 0 }, // priced from floors below
};

/** 6x8 m parametric block: $/m² of gross floor area. */
export const BLOCK_PRICE_PER_FLOOR = 6 * 8 * 400;

/** Generate deterministic "existing buildings" around a clicked coordinate. */
function generateBuildings(lng: number, lat: number): Building[] {
  const rand = seededRandom(lng * 13.37 + lat * 42.42);
  const count = 3 + Math.floor(rand() * 4);
  const buildings: Building[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 6 + rand() * 6; // keep them just outside the 10x10 sandbox
    const w = 2 + rand() * 4;
    const d = 2 + rand() * 4;
    const h = 3 + rand() * 12;
    buildings.push({
      id: `b-${i}`,
      position: [Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist],
      size: [w, h, d],
      rotation: rand() * Math.PI,
    });
  }
  return buildings;
}

export type OsmStatus = "idle" | "loading" | "ready" | "fallback";

interface UrbanState {
  // Map <-> 3D sync
  selected: { lng: number; lat: number } | null;
  buildings: Building[];
  /** Real OSM surroundings for the selected point (null while loading/failed). */
  surroundings: Surroundings | null;
  osmStatus: OsmStatus;
  selectPoint: (lng: number, lat: number) => void;

  /** Building picked in the 3D scene (for AI facade texturing). */
  activeBuildingId: number | null;
  setActiveBuilding: (id: number | null) => void;
  /** AI-generated facade texture URLs per OSM building id. */
  buildingTextures: Record<number, string>;
  setBuildingTexture: (id: number, url: string) => void;
  /** Neural scene reconstruction results per OSM building id. */
  buildingSpecs: Record<number, SceneAnalysis>;
  setBuildingSpec: (id: number, spec: SceneAnalysis) => void;

  // Sandbox objects — `objects` always mirrors the active scenario
  objects: PlacedObject[];
  scenarios: Record<ScenarioId, PlacedObject[]>;
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  activeObjectId: string | null;
  addObject: (kind: Exclude<ObjectKind, "ai">) => void;
  addAIObject: (label: string, price: number) => void;
  removeObject: (id: string) => void;
  setActiveObject: (id: string | null) => void;
  moveObject: (id: string, position: [number, number, number]) => void;
  updateObject: (id: string, patch: Partial<PlacedObject>) => void;

  // ArcGIS-Urban-style analysis state
  timeOfDay: number; // hours, 0..24
  setTimeOfDay: (h: number) => void;
  showZoning: boolean;
  toggleZoning: () => void;
  /** Real satellite orthophoto on the ground + real roofs. */
  showSatellite: boolean;
  toggleSatellite: () => void;

  // Transform gizmo <-> orbit controls coordination
  transforming: boolean;
  setTransforming: (v: boolean) => void;

  // AI pillar state
  sentiment: SentimentResult | null;
  sentimentLoading: boolean;
  setSentiment: (s: SentimentResult | null) => void;
  setSentimentLoading: (v: boolean) => void;

  compliance: ComplianceResult;
  setCompliance: (c: ComplianceResult) => void;

  totalCost: () => number;
}

let objectCounter = 0;
let osmRequestId = 0;

export const useStore = create<UrbanState>((set, get) => ({
  selected: null,
  buildings: [],
  surroundings: null,
  osmStatus: "idle",
  selectPoint: (lng, lat) => {
    const requestId = ++osmRequestId;
    set({
      selected: { lng, lat },
      buildings: generateBuildings(lng, lat),
      surroundings: null,
      osmStatus: "loading",
      objects: [],
      scenarios: { A: [], B: [] },
      activeObjectId: null,
      activeBuildingId: null,
      buildingTextures: {},
      buildingSpecs: {},
      sentiment: null,
      compliance: {
        status: "idle",
        message: "No objects placed yet",
        layers: [],
      },
    });
    // Pull real buildings/roads/trees from OpenStreetMap; keep the
    // procedural blocks as a fallback if every Overpass mirror fails.
    fetchSurroundings(lng, lat)
      .then((s) => {
        if (requestId !== osmRequestId) return; // a newer click won
        if (s && s.buildings.length + s.roads.length > 0) {
          set({ surroundings: s, osmStatus: "ready" });
        } else {
          set({ osmStatus: "fallback" });
        }
      })
      .catch(() => {
        if (requestId === osmRequestId) set({ osmStatus: "fallback" });
      });
  },

  activeBuildingId: null,
  setActiveBuilding: (activeBuildingId) => set({ activeBuildingId }),
  buildingTextures: {},
  setBuildingTexture: (id, url) =>
    set((s) => ({ buildingTextures: { ...s.buildingTextures, [id]: url } })),
  buildingSpecs: {},
  setBuildingSpec: (id, spec) =>
    set((s) => ({ buildingSpecs: { ...s.buildingSpecs, [id]: spec } })),

  objects: [],
  scenarios: { A: [], B: [] },
  scenario: "A",
  setScenario: (scenario) =>
    set((s) => ({
      scenario,
      objects: s.scenarios[scenario],
      activeObjectId: null,
    })),
  activeObjectId: null,
  addObject: (kind) => {
    const { label, price } = CATALOG[kind];
    const id = `obj-${++objectCounter}`;
    const jitter = () => (Math.random() - 0.5) * 6;
    set((s) => {
      const obj: PlacedObject = {
        id,
        kind,
        label,
        price,
        position: [jitter(), 0, jitter()],
      };
      if (kind === "block") {
        obj.floors = 5;
        obj.use = "residential";
        obj.price = BLOCK_PRICE_PER_FLOOR * 5;
        obj.label = "Dev Block · 5 fl";
        obj.position = [0, 0, 0];
      }
      const objects = [...s.objects, obj];
      return {
        objects,
        scenarios: { ...s.scenarios, [s.scenario]: objects },
        activeObjectId: id,
      };
    });
  },
  addAIObject: (label, price) => {
    const id = `obj-${++objectCounter}`;
    set((s) => {
      const objects: PlacedObject[] = [
        ...s.objects,
        { id, kind: "ai" as const, label, price, position: [0, 0, 0] as [number, number, number] },
      ];
      return {
        objects,
        scenarios: { ...s.scenarios, [s.scenario]: objects },
        activeObjectId: id,
      };
    });
  },
  removeObject: (id) =>
    set((s) => {
      const objects = s.objects.filter((o) => o.id !== id);
      return {
        objects,
        scenarios: { ...s.scenarios, [s.scenario]: objects },
        activeObjectId: s.activeObjectId === id ? null : s.activeObjectId,
      };
    }),
  setActiveObject: (id) => set({ activeObjectId: id }),
  moveObject: (id, position) =>
    set((s) => {
      const objects = s.objects.map((o) => (o.id === id ? { ...o, position } : o));
      return { objects, scenarios: { ...s.scenarios, [s.scenario]: objects } };
    }),
  updateObject: (id, patch) =>
    set((s) => {
      const objects = s.objects.map((o) => {
        if (o.id !== id) return o;
        const next = { ...o, ...patch };
        if (next.kind === "block") {
          next.price = BLOCK_PRICE_PER_FLOOR * (next.floors ?? 1);
          next.label = `Dev Block · ${next.floors} fl`;
        }
        return next;
      });
      return { objects, scenarios: { ...s.scenarios, [s.scenario]: objects } };
    }),

  timeOfDay: 17.5,
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  showZoning: true,
  toggleZoning: () => set((s) => ({ showZoning: !s.showZoning })),
  showSatellite: true,
  toggleSatellite: () => set((s) => ({ showSatellite: !s.showSatellite })),

  transforming: false,
  setTransforming: (v) => set({ transforming: v }),

  sentiment: null,
  sentimentLoading: false,
  setSentiment: (sentiment) => set({ sentiment }),
  setSentimentLoading: (sentimentLoading) => set({ sentimentLoading }),

  compliance: { status: "idle", message: "Select a site to begin", layers: [] },
  setCompliance: (compliance) => set({ compliance }),

  totalCost: () => get().objects.reduce((sum, o) => sum + o.price, 0),
}));

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__urbanStore = useStore;
}
