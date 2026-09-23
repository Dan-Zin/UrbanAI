import type { InitiativeIntent } from "./domain";
import { MAF_SIZES } from "./catalog";

export type { InitiativeIntent };

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export type ViewObjectType =
  | "bench"
  | "bin"
  | "lamp"
  | "paving"
  | "greenery"
  | "parking_pocket"
  | "playground_element";

export interface ViewObject {
  id: string;
  type: ViewObjectType;
  catalogId?: string;
  source: "mask" | "catalog" | "gipoteza";
  status: "eskiz";
  groundAnchor?: { lat: number; lng: number } | { u: number; v: number };
  sizeMeters: { w: number; d: number; h: number };
  /** True only when the user marked the ground plane or a studio camera was stored. */
  placedWithGeometry: boolean;
}

export interface SiteView {
  id: string;
  initiativeId: string;
  contourHint?: GeoJsonPolygon | null;
  createdAt: string;
  source: "upload" | "panorama" | "studio";
  imageDataUrl: string;
  camera: {
    lat: number;
    lng: number;
    heading?: number;
    pitch?: number;
    fov?: number;
    studioCamera?: {
      position: [number, number, number];
      target: [number, number, number];
    };
  };
  /** Street panorama that cannot see into the yard. */
  visibility: "street_ok" | "yard_blind";
  mask: {
    kind: "lasso" | "brush" | "rect";
    points: { x: number; y: number }[];
    excludeWindows: boolean;
  };
  templateId: string;
  mode: "inpaint" | "place_object";
  status: "natura" | "eskiz" | "gipoteza";
  resultImageDataUrl?: string;
  objects: ViewObject[];
  conflicts: string[];
}

export const SKETCH_DISCLAIMER = "Эскиз для обсуждения, не проект и не обмер";

export const YARD_BLIND_WARNING =
  "Уличная панорама не показывает внутренность двора. Генерация внутрь — гипотеза, не реконструкция.";

const PROMPT_GUARD =
  "Измени ТОЛЬКО область маски. Сохрани перспективу, освещение, геометрию зданий. Не рисуй окна квартир, лица, номера машин, чужие фасады крупно. Не меняй этажность и ширину проезда. Стиль — этот конкретный южный двор / Таганрог, не европейский дворик и не парк новой Москвы. Результат — эскиз благоустройства, не фотофиксация.";

export interface ActionTemplate {
  id: string;
  label: string;
  prompt: string;
  /** Concrete things the template would add. Exact match against the place dictionary. */
  introduces: string[];
  objectType: ViewObjectType | null;
  catalogId: string | null;
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    id: "replace_paving",
    label: "Заменить покрытие в маске",
    introduces: ["бетонная плитка"],
    objectType: "paving",
    catalogId: "maf-paving",
    prompt: `Внутри маски замени изношенное покрытие на бетонную плитку этого двора. ${PROMPT_GUARD}`,
  },
  {
    id: "add_bench",
    label: "Поставить скамью",
    introduces: ["скамья"],
    objectType: "bench",
    catalogId: "maf-bench",
    prompt: `Внутри маски поставь обычную дворовой скамейку со спинкой, в масштабе кадра. ${PROMPT_GUARD}`,
  },
  {
    id: "add_bin",
    label: "Поставить урну",
    introduces: ["урна"],
    objectType: "bin",
    catalogId: "maf-bin",
    prompt: `Внутри маски поставь обычную дворовую урну. ${PROMPT_GUARD}`,
  },
  {
    id: "add_lamp",
    label: "Поставить светильник",
    introduces: ["светильник"],
    objectType: "lamp",
    catalogId: "maf-lamp",
    prompt: `Внутри маски поставь обычный дворовой светильник на опоре. ${PROMPT_GUARD}`,
  },
  {
    id: "add_greenery",
    label: "Озеленение",
    introduces: ["местная зелень"],
    objectType: "greenery",
    catalogId: "maf-tree",
    prompt: `Внутри маски добавь местную зелень: дерево или куст южного двора, не экзотический парк. ${PROMPT_GUARD}`,
  },
  {
    id: "remove_parking",
    label: "Убрать парковочный карман",
    introduces: ["грунт"],
    objectType: null,
    catalogId: null,
    prompt: `Внутри маски убери парковочный карман и верни покрытие двора. Не рисуй новый карман. ${PROMPT_GUARD}`,
  },
  {
    id: "mark_defect_visual",
    label: "Подсветить дефект",
    introduces: [],
    objectType: null,
    catalogId: null,
    prompt: `Только подсвети уже видимый дефект контуром. Не перерисовывай двор и не добавляй МАФ. ${PROMPT_GUARD}`,
  },
];

export interface PlaceRule {
  name: string;
  materials: string[];
  forbidden: string[];
}

/** Mock dictionary for two Taganrog districts. Other districts are not blocked. */
export const PLACE_DICTIONARY: Record<string, PlaceRule> = {
  central: {
    name: "Центральный",
    materials: ["бетонная плитка", "асфальт", "грунт", "местная зелень"],
    forbidden: ["стеклянная пергола", "скамья-арт объект"],
  },
  primorsky: {
    name: "Приморский",
    materials: ["бетонная плитка", "асфальт", "грунт", "местная зелень"],
    forbidden: ["стеклянная пергола", "скамья-арт объект"],
  },
};

const DEFECT_RE =
  /ям|полом|слом|не горит|гасн|провал|люк|мусор|крыс|протеч|авари|порван|переполн|т[её]мн|бордюр сбит|неисправ/;
const PROPOSAL_RE =
  /хочет|хотим|предлага|скаме|скамь|урн|посад|озелен|клумб|зону отдыха|благоустр|вместо|несколько дерев/;

export function classifyIntent(
  title: string,
  description: string,
  explicit?: InitiativeIntent
): InitiativeIntent {
  if (explicit) return explicit;
  const text = `${title} ${description}`.toLowerCase();
  const defect = DEFECT_RE.test(text);
  const proposal = PROPOSAL_RE.test(text);
  if (proposal && !defect) return "proposal";
  if (defect) return "defect";
  if (proposal) return "proposal";
  return "defect";
}

export function allowsNaturalView(item: {
  title: string;
  description: string;
  intent?: InitiativeIntent;
}): boolean {
  return classifyIntent(item.title, item.description, item.intent) === "proposal";
}

export function templateById(id: string): ActionTemplate | undefined {
  return ACTION_TEMPLATES.find((t) => t.id === id);
}

export function templateConflicts(templateId: string, districtId: string): string[] {
  const place = PLACE_DICTIONARY[districtId];
  const template = templateById(templateId);
  if (!place || !template) return [];
  const reasons: string[] = [];
  for (const item of template.introduces) {
    const banned = place.forbidden.find((f) => f.toLowerCase() === item.toLowerCase());
    if (banned) {
      reasons.push(
        `Шаблон «${template.label}» добавляет «${banned}». Словарь района «${place.name}» это запрещает.`
      );
    }
    const materialLike = /плитк|асфальт|грунт|зелен/.test(item.toLowerCase());
    if (materialLike && !place.materials.some((m) => m.toLowerCase() === item.toLowerCase())) {
      reasons.push(
        `Материал «${item}» не входит в допустимые для района «${place.name}»: ${place.materials.join(", ")}.`
      );
    }
  }
  return reasons;
}

export function catalogConflicts(label: string, districtId: string): string[] {
  const place = PLACE_DICTIONARY[districtId];
  if (!place) return [];
  const banned = place.forbidden.find((f) => label.toLowerCase().includes(f.toLowerCase()));
  if (!banned) return [];
  return [
    `«${label}» совпадает с запретом словаря района «${place.name}»: ${banned}. Модель не вызывается.`,
  ];
}

export function emptyMask(): SiteView["mask"] {
  return { kind: "lasso", points: [], excludeWindows: true };
}

/** Square hint around the request point. Not a measured yard outline. */
export function contourAround(lng: number, lat: number, meters = 24): GeoJsonPolygon {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const dLat = meters / 2 / mPerDegLat;
  const dLng = meters / 2 / mPerDegLng;
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ],
    ],
  };
}

/** Same axes as services/osm.ts: +x east, +z south. */
export function localMetersToLngLat(
  originLng: number,
  originLat: number,
  x: number,
  z: number
): { lng: number; lat: number } {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((originLat * Math.PI) / 180);
  return {
    lng: originLng + x / mPerDegLng,
    lat: originLat - z / mPerDegLat,
  };
}

export function lngLatToLocal(
  originLng: number,
  originLat: number,
  lng: number,
  lat: number
): { x: number; z: number } {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((originLat * Math.PI) / 180);
  return {
    x: (lng - originLng) * mPerDegLng,
    z: -(lat - originLat) * mPerDegLat,
  };
}

export function isLngLatAnchor(
  anchor: ViewObject["groundAnchor"]
): anchor is { lat: number; lng: number } {
  return !!anchor && "lat" in anchor && "lng" in anchor;
}

export function mafSize(catalogId: string | null | undefined): { w: number; d: number; h: number } {
  if (catalogId && MAF_SIZES[catalogId]) return MAF_SIZES[catalogId];
  return { w: 1, d: 1, h: 1 };
}

export function viewObjectTypeForCatalog(catalogId: string): ViewObjectType {
  switch (catalogId) {
    case "maf-bench":
      return "bench";
    case "maf-bin":
      return "bin";
    case "maf-lamp":
      return "lamp";
    case "maf-paving":
      return "paving";
    case "maf-tree":
      return "greenery";
    case "maf-pocket":
      return "parking_pocket";
    default:
      return "playground_element";
  }
}

export const OBJECT_TYPE_LABELS: Record<ViewObjectType, string> = {
  bench: "Скамья",
  bin: "Урна",
  lamp: "Светильник",
  paving: "Покрытие",
  greenery: "Озеленение",
  parking_pocket: "Парковочный карман",
  playground_element: "Элемент площадки",
};
