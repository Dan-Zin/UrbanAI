import { create } from "zustand";
import { seededRandom } from "./utils";
import { SANDBOX_SIZE } from "./constants";
import { BUILTIN_CATALOG, type CatalogItem, type GeneratedMesh } from "./catalog";
import { fetchSurroundings, type Surroundings } from "@/services/osm";
import type { SceneAnalysis } from "@/services/ai";

export const TAGANROG_CENTER: [number, number] = [38.9265, 47.2123];

export type ObjectKind = "tree" | "bench" | "lamp" | "fountain" | "block" | "ai" | "catalog";
export type BlockUse = "residential" | "commercial" | "mixed";
export type ScenarioId = "A" | "B";
export type MapStyleId = "schematic" | "satellite";
export type TransformMode = "translate" | "rotate" | "scale";

export interface PanelChrome {
  pinned: boolean;
  hidden: boolean;
}

export const DEFAULT_PANELS: Record<string, PanelChrome> = {
  header: { pinned: true, hidden: false },
  catalog: { pinned: true, hidden: false },
  ai: { pinned: false, hidden: true },
  metrics: { pinned: false, hidden: false },
  time: { pinned: false, hidden: false },
  zoning: { pinned: false, hidden: false },
  inspector: { pinned: false, hidden: false },
};

export const PANEL_LABELS: Record<string, string> = {
  header: "Шапка",
  catalog: "Каталог",
  ai: "AI-панели",
  metrics: "Ёмкость",
  time: "Время суток",
  zoning: "Слои",
  inspector: "Инспектор",
};

export interface PlacedObject {
  id: string;
  kind: ObjectKind;
  label: string;
  price: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /** Parametric development block fields (kind === "block") */
  floors?: number;
  use?: BlockUse;
  catalogId?: string;
  mesh?: GeneratedMesh;
  /** Translucent MAF brought in from a natural-view sketch. Not a measured placement. */
  sketch?: boolean;
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
  Exclude<ObjectKind, "ai" | "catalog">,
  { label: string; price: number }
> = {
  tree: { label: "Дерево", price: 200 },
  bench: { label: "Скамейка", price: 500 },
  lamp: { label: "Фонарь", price: 350 },
  fountain: { label: "Фонтан", price: 4200 },
  block: { label: "Квартал", price: 0 },
};

/** 6x8 m parametric block: $/m² of gross floor area. */
export const BLOCK_PRICE_PER_FLOOR = 6 * 8 * 400;

function panelOf(
  state: Record<string, PanelChrome>,
  id: string
): PanelChrome {
  return state[id] ?? DEFAULT_PANELS[id] ?? { pinned: false, hidden: false };
}

/** Generate deterministic "existing buildings" around a clicked coordinate. */
function generateBuildings(lng: number, lat: number): Building[] {
  const rand = seededRandom(lng * 13.37 + lat * 42.42);
  const count = 3 + Math.floor(rand() * 4);
  const buildings: Building[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = SANDBOX_SIZE / 2 + 4 + rand() * 10;
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
  addObject: (kind: Exclude<ObjectKind, "ai" | "catalog">) => void;
  addAIObject: (label: string, price: number, mesh?: GeneratedMesh) => void;
  addFromCatalog: (catalogId: string) => void;
  addSketchObject: (object: Omit<PlacedObject, "id">) => void;
  clearSketches: () => void;
  removeObject: (id: string) => void;
  setActiveObject: (id: string | null) => void;
  moveObject: (id: string, position: [number, number, number]) => void;
  updateObject: (id: string, patch: Partial<PlacedObject>) => void;

  catalog: CatalogItem[];
  addCatalogItem: (item: CatalogItem) => void;

  // ArcGIS-Urban-style analysis state
  timeOfDay: number; // hours, 0..24
  setTimeOfDay: (h: number) => void;
  showZoning: boolean;
  toggleZoning: () => void;
  /** Real satellite orthophoto on the ground + real roofs. */
  showSatellite: boolean;
  toggleSatellite: () => void;
  /** Run an image model on the stitched orthophoto before draping. */
  enhanceSatellite: boolean;
  toggleEnhanceSatellite: () => void;
  satelliteStatus: "idle" | "loading" | "enhancing" | "ready" | "failed";
  satelliteDetail: string;
  setSatelliteStatus: (s: UrbanState["satelliteStatus"], detail?: string) => void;

  mapHidden: boolean;
  mapStyle: MapStyleId;
  toggleMapHidden: () => void;
  setMapHidden: (v: boolean) => void;
  setMapStyle: (s: MapStyleId) => void;

  uiHidden: boolean;
  toggleUiHidden: () => void;
  setUiHidden: (v: boolean) => void;
  panelState: Record<string, PanelChrome>;
  togglePanelPin: (id: string) => void;
  togglePanelHidden: (id: string) => void;
  setPanelHidden: (id: string, hidden: boolean) => void;

  // Transform gizmo <-> orbit controls coordination
  transforming: boolean;
  setTransforming: (v: boolean) => void;
  transformMode: TransformMode;
  setTransformMode: (m: TransformMode) => void;

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

function jitter(): number {
  return (Math.random() - 0.5) * SANDBOX_SIZE * 0.55;
}

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
        message: "На площадке ещё нет объектов",
        layers: [],
      },
    });
    fetchSurroundings(lng, lat)
      .then((s) => {
        if (requestId !== osmRequestId) return;
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
    set((s) => {
      const obj: PlacedObject = {
        id,
        kind,
        label,
        price,
        position: [jitter(), 0, jitter()],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      if (kind === "block") {
        obj.floors = 5;
        obj.use = "residential";
        obj.price = BLOCK_PRICE_PER_FLOOR * 5;
        obj.label = "Квартал · 5 эт.";
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
  addAIObject: (label, price, mesh) => {
    const id = `obj-${++objectCounter}`;
    set((s) => {
      const objects: PlacedObject[] = [
        ...s.objects,
        {
          id,
          kind: mesh ? "catalog" : "ai",
          label,
          price,
          position: [jitter(), 0, jitter()],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          mesh,
        },
      ];
      return {
        objects,
        scenarios: { ...s.scenarios, [s.scenario]: objects },
        activeObjectId: id,
      };
    });
  },
  addSketchObject: (object) => {
    const id = `sketch-${++objectCounter}`;
    set((s) => {
      const objects = [...s.objects, { ...object, id, sketch: true }];
      return {
        objects,
        scenarios: { ...s.scenarios, [s.scenario]: objects },
      };
    });
  },
  clearSketches: () =>
    set((s) => {
      const objects = s.objects.filter((o) => !o.sketch);
      return { objects, scenarios: { ...s.scenarios, [s.scenario]: objects } };
    }),
  addFromCatalog: (catalogId) => {
    const item = get().catalog.find((c) => c.id === catalogId);
    if (!item) return;
    if (item.builtinKind) {
      get().addObject(item.builtinKind);
      return;
    }
    const id = `obj-${++objectCounter}`;
    set((s) => {
      const objects: PlacedObject[] = [
        ...s.objects,
        {
          id,
          kind: "catalog",
          label: item.label,
          price: item.price,
          position: [jitter(), 0, jitter()],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          catalogId: item.id,
          mesh: item.mesh,
        },
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
          next.label = `Квартал · ${next.floors} эт.`;
        }
        return next;
      });
      return { objects, scenarios: { ...s.scenarios, [s.scenario]: objects } };
    }),

  catalog: BUILTIN_CATALOG,
  addCatalogItem: (item) =>
    set((s) => ({ catalog: [item, ...s.catalog] })),

  timeOfDay: 17.5,
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  showZoning: true,
  toggleZoning: () => set((s) => ({ showZoning: !s.showZoning })),
  showSatellite: true,
  toggleSatellite: () => set((s) => ({ showSatellite: !s.showSatellite })),
  enhanceSatellite: true,
  toggleEnhanceSatellite: () =>
    set((s) => ({ enhanceSatellite: !s.enhanceSatellite })),
  satelliteStatus: "idle",
  satelliteDetail: "",
  setSatelliteStatus: (satelliteStatus, satelliteDetail = "") =>
    set({ satelliteStatus, satelliteDetail }),

  mapHidden: false,
  mapStyle: "schematic",
  toggleMapHidden: () => set((s) => ({ mapHidden: !s.mapHidden })),
  setMapHidden: (mapHidden) => set({ mapHidden }),
  setMapStyle: (mapStyle) => set({ mapStyle }),

  uiHidden: false,
  toggleUiHidden: () => set((s) => ({ uiHidden: !s.uiHidden })),
  setUiHidden: (uiHidden) => set({ uiHidden }),
  panelState: { ...DEFAULT_PANELS },
  togglePanelPin: (id) =>
    set((s) => {
      const cur = panelOf(s.panelState, id);
      return { panelState: { ...s.panelState, [id]: { ...cur, pinned: !cur.pinned } } };
    }),
  togglePanelHidden: (id) =>
    set((s) => {
      const cur = panelOf(s.panelState, id);
      return { panelState: { ...s.panelState, [id]: { ...cur, hidden: !cur.hidden } } };
    }),
  setPanelHidden: (id, hidden) =>
    set((s) => {
      const cur = panelOf(s.panelState, id);
      return { panelState: { ...s.panelState, [id]: { ...cur, hidden } } };
    }),

  transforming: false,
  setTransforming: (v) => set({ transforming: v }),
  transformMode: "translate",
  setTransformMode: (transformMode) => set({ transformMode }),

  sentiment: null,
  sentimentLoading: false,
  setSentiment: (sentiment) => set({ sentiment }),
  setSentimentLoading: (sentimentLoading) => set({ sentimentLoading }),

  compliance: { status: "idle", message: "Выберите точку на карте", layers: [] },
  setCompliance: (compliance) => set({ compliance }),

  totalCost: () => get().objects.reduce((sum, o) => sum + o.price, 0),
}));

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__urbanStore = useStore;
}
