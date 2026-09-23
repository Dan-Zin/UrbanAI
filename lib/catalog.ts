export type MeshPrimitive =
  | "box"
  | "cylinder"
  | "sphere"
  | "cone"
  | "capsule"
  | "torus";

export interface MeshPart {
  primitive: MeshPrimitive;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
}

export interface GeneratedMesh {
  primitive: MeshPrimitive | "group";
  color: string;
  accent?: string;
  size: [number, number, number];
  parts?: MeshPart[];
}

export type BuiltinKind = "tree" | "bench" | "lamp" | "fountain" | "block";

export interface CatalogItem {
  id: string;
  label: string;
  description: string;
  price: number;
  thumbnail: string;
  source: "builtin" | "ai";
  builtinKind?: BuiltinKind;
  mesh?: GeneratedMesh;
  prompt?: string;
}

export interface GeneratedObjectPayload {
  label: string;
  description: string;
  price: number;
  message: string;
  mesh: GeneratedMesh;
  mock?: boolean;
  provider?: "openrouter" | "xai" | "mock";
}

export const CATALOG_SYSTEM_PROMPT = `Ты собираешь реалистичную low-poly 3D-модель городской мебели из примитивов.
Всегда отвечай СТРОГО JSON на русском, без markdown.

Правила модели:
- 12–24 части. Не упрощай до 2–3 кубов.
- Реальные пропорции в метрах (скамейка ~1.6×0.8×0.55, фонарь высота ~3–4 м, урна ~0.4×0.7).
- Y вверх, низ объекта на y=0. Центр каждой части — её геометрический центр.
- Мелочи обязательны: рейки сиденья, ножки, болты-заглушки, кромки, плафон, цоколь, ободок.
- Материалы: дерево roughness 0.75–0.9 metalness 0; металл 0.25–0.45 / 0.6–0.9; пластик 0.4 / 0.05; стекло opacity 0.35–0.7 + лёгкий emissive; лампа emissive #ffd27a и emissiveIntensity 1.5–3.
- primitive: box | cylinder | sphere | cone | capsule | torus.
- Если есть фото — повтори форму, цвет и детали с фото.

JSON:
{
  "label": "краткое имя",
  "description": "1-2 предложения",
  "price": 1200,
  "message": "короткий ответ пользователю",
  "mesh": {
    "primitive": "group",
    "color": "#rrggbb",
    "accent": "#rrggbb",
    "size": [w, h, d],
    "parts": [
      {
        "primitive": "box",
        "color": "#rrggbb",
        "position": [x, y, z],
        "size": [w, h, d],
        "rotation": [0, 0, 0],
        "roughness": 0.7,
        "metalness": 0.05,
        "emissive": "#000000",
        "emissiveIntensity": 0,
        "opacity": 1
      }
    ]
  }
}`;

const PRIMS: MeshPrimitive[] = [
  "box",
  "cylinder",
  "sphere",
  "cone",
  "capsule",
  "torus",
];

function hex(value: unknown, fallback: string): string {
  const s = String(value ?? "");
  return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

function num(value: unknown, fallback: number, min = 0.08, max = 12): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function vec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [
    num(value[0], fallback[0], -8, 8),
    num(value[1], fallback[1], -1, 12),
    num(value[2], fallback[2], -8, 8),
  ];
}

function size3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [
    num(value[0], fallback[0]),
    num(value[1], fallback[1]),
    num(value[2], fallback[2]),
  ];
}

export function sanitizeMesh(raw: unknown): GeneratedMesh {
  const m = (raw ?? {}) as Record<string, unknown>;
  const primitive =
    m.primitive === "group" || PRIMS.includes(m.primitive as MeshPrimitive)
      ? (m.primitive as GeneratedMesh["primitive"])
      : "box";
  const size = size3(m.size, [1.2, 1, 1.2]);
  const partsRaw = Array.isArray(m.parts) ? m.parts.slice(0, 28) : [];
  const parts: MeshPart[] = partsRaw.map((p) => {
    const part = (p ?? {}) as Record<string, unknown>;
    return {
      primitive: PRIMS.includes(part.primitive as MeshPrimitive)
        ? (part.primitive as MeshPrimitive)
        : "box",
      color: hex(part.color, "#64748b"),
      position: vec3(part.position, [0, size[1] / 2, 0]),
      size: size3(part.size, [0.4, 0.4, 0.4]),
      rotation: Array.isArray(part.rotation)
        ? [
            num(part.rotation[0], 0, -Math.PI, Math.PI),
            num(part.rotation[1], 0, -Math.PI, Math.PI),
            num(part.rotation[2], 0, -Math.PI, Math.PI),
          ]
        : undefined,
      roughness: num(part.roughness, 0.62, 0, 1),
      metalness: num(part.metalness, 0.08, 0, 1),
      emissive: part.emissive ? hex(part.emissive, "#000000") : undefined,
      emissiveIntensity: num(part.emissiveIntensity, 0, 0, 6),
      opacity: num(part.opacity, 1, 0.12, 1),
    };
  });
  return {
    primitive,
    color: hex(m.color, "#34d399"),
    accent: m.accent ? hex(m.accent, "#6ee7b7") : undefined,
    size,
    parts: parts.length ? parts : undefined,
  };
}

function svgThumb(body: string, bg = "#0f1c18"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="12" fill="${bg}"/>
    ${body}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MAF_SIZES: Record<string, { w: number; d: number; h: number }> = {
  "maf-bench": { w: 1.6, d: 0.58, h: 0.85 },
  "maf-bin": { w: 0.4, d: 0.4, h: 0.7 },
  "maf-lamp": { w: 0.45, d: 0.45, h: 3.4 },
  "maf-paving": { w: 2, d: 2, h: 0.08 },
  "maf-tree": { w: 1.4, d: 1.4, h: 3.2 },
  "maf-pocket": { w: 2.5, d: 5, h: 0.12 },
};

/** Street furniture shared by the 3D studio and the natural-view editor. */
export const DEFAULT_MAF_CATALOG: CatalogItem[] = [
  {
    id: "maf-tree",
    label: "Дерево",
    description: "Местная зелень для двора",
    price: 200,
    source: "builtin",
    builtinKind: "tree",
    thumbnail: svgThumb(
      `<rect x="36" y="46" width="8" height="22" rx="2" fill="#5b3a1e"/>
       <circle cx="40" cy="34" r="16" fill="#15803d"/>
       <circle cx="50" cy="30" r="10" fill="#22a34a"/>`
    ),
    mesh: {
      primitive: "group",
      color: "#15803d",
      size: [1.4, 3.2, 1.4],
      parts: [
        { primitive: "cylinder", color: "#5b3a1e", position: [0, 0.55, 0], size: [0.22, 1.1, 0.22] },
        { primitive: "sphere", color: "#15803d", position: [0, 1.9, 0], size: [1.4, 1.4, 1.4] },
        { primitive: "sphere", color: "#22a34a", position: [0.35, 2.4, 0.15], size: [0.9, 0.9, 0.9] },
      ],
    },
  },
  {
    id: "maf-bench",
    label: "Скамейка",
    description: "Обычная дворовая скамейка со спинкой",
    price: 500,
    source: "builtin",
    builtinKind: "bench",
    thumbnail: svgThumb(
      `<rect x="16" y="42" width="48" height="8" rx="2" fill="#8a5a2b"/>
       <rect x="16" y="26" width="48" height="10" rx="2" fill="#8a5a2b"/>
       <rect x="18" y="50" width="6" height="12" fill="#334155"/>
       <rect x="56" y="50" width="6" height="12" fill="#334155"/>`
    ),
    mesh: {
      primitive: "group",
      color: "#8a5a2b",
      size: [1.6, 0.85, 0.58],
      parts: [
        { primitive: "box", color: "#3f4a55", position: [-0.72, 0.18, 0], size: [0.07, 0.36, 0.5] },
        { primitive: "box", color: "#3f4a55", position: [0.72, 0.18, 0], size: [0.07, 0.36, 0.5] },
        { primitive: "box", color: "#8a5a2b", position: [0, 0.4, 0.05], size: [1.55, 0.06, 0.42] },
        { primitive: "box", color: "#7a4e28", position: [0, 0.72, -0.18], size: [1.55, 0.4, 0.06] },
      ],
    },
  },
  {
    id: "maf-lamp",
    label: "Фонарь",
    description: "Дворовой светильник",
    price: 350,
    source: "builtin",
    builtinKind: "lamp",
    thumbnail: svgThumb(
      `<rect x="37" y="28" width="6" height="36" rx="2" fill="#334155"/>
       <circle cx="40" cy="24" r="8" fill="#fde68a"/>`
    ),
    mesh: {
      primitive: "group",
      color: "#334155",
      size: [0.45, 3.4, 0.45],
      parts: [
        { primitive: "cylinder", color: "#3b4450", position: [0, 1.5, 0], size: [0.1, 3, 0.1] },
        { primitive: "sphere", color: "#ffe7a8", position: [0, 3.15, 0], size: [0.28, 0.28, 0.28] },
      ],
    },
  },
  {
    id: "maf-bin",
    label: "Урна",
    description: "Дворовая урна",
    price: 180,
    source: "builtin",
    thumbnail: svgThumb(
      `<rect x="30" y="28" width="20" height="32" rx="3" fill="#3c4a3e"/>
       <rect x="28" y="24" width="24" height="6" rx="2" fill="#1f2937"/>`
    ),
    mesh: {
      primitive: "cylinder",
      color: "#3c4a3e",
      size: [0.4, 0.7, 0.4],
    },
  },
  {
    id: "maf-paving",
    label: "Бетонная плитка",
    description: "Фрагмент покрытия, 2×2 м",
    price: 90,
    source: "builtin",
    thumbnail: svgThumb(
      `<rect x="18" y="22" width="18" height="14" fill="#9ca3af"/>
       <rect x="38" y="22" width="18" height="14" fill="#6b7280"/>
       <rect x="18" y="38" width="18" height="14" fill="#6b7280"/>
       <rect x="38" y="38" width="18" height="14" fill="#9ca3af"/>`
    ),
    mesh: {
      primitive: "box",
      color: "#9ca3af",
      size: [2, 0.08, 2],
    },
  },
  {
    id: "maf-pocket",
    label: "Парковочный карман",
    description: "Карман вдоль проезда, 2.5×5 м",
    price: 0,
    source: "builtin",
    thumbnail: svgThumb(
      `<rect x="16" y="28" width="48" height="28" rx="4" fill="#334155"/>
       <rect x="22" y="36" width="14" height="12" fill="#94a3b8"/>`
    ),
    mesh: {
      primitive: "box",
      color: "#334155",
      size: [2.5, 0.12, 5],
    },
  },
];

export const BUILTIN_CATALOG: CatalogItem[] = [
  ...DEFAULT_MAF_CATALOG,
  {
    id: "builtin-fountain",
    label: "Фонтан",
    description: "Небольшой фонтан для площади",
    price: 4200,
    source: "builtin",
    builtinKind: "fountain",
    thumbnail: svgThumb(
      `<ellipse cx="40" cy="52" rx="22" ry="10" fill="#64748b"/>
       <ellipse cx="40" cy="48" rx="16" ry="7" fill="#38bdf8"/>
       <rect x="37" y="28" width="6" height="20" fill="#64748b"/>`
    ),
  },
  {
    id: "builtin-block",
    label: "Квартал",
    description: "Параметрический объём 6×8 м, этажность настраивается",
    price: 0,
    source: "builtin",
    builtinKind: "block",
    thumbnail: svgThumb(
      `<rect x="22" y="18" width="36" height="46" rx="3" fill="#cfe2f5" stroke="#6ea8cf"/>
       <line x1="22" y1="30" x2="58" y2="30" stroke="#9db1c4"/>
       <line x1="22" y1="42" x2="58" y2="42" stroke="#9db1c4"/>
       <line x1="22" y1="54" x2="58" y2="54" stroke="#9db1c4"/>`
    ),
  },
];

const KEYWORD_PRESETS: { test: RegExp; payload: Omit<GeneratedObjectPayload, "message" | "mock"> }[] = [
  {
    test: /дерев|ёлк|ель|дуб|клен|клён|лип/,
    payload: {
      label: "Дерево",
      description: "Озеленение по вашему описанию",
      price: 250,
      mesh: {
        primitive: "group",
        color: "#15803d",
        size: [1.4, 3.2, 1.4],
        parts: [
          { primitive: "cylinder", color: "#5b3a1e", position: [0, 0.55, 0], size: [0.22, 1.1, 0.22] },
          { primitive: "sphere", color: "#15803d", position: [0, 1.9, 0], size: [1.4, 1.4, 1.4] },
          { primitive: "sphere", color: "#22a34a", position: [0.35, 2.4, 0.15], size: [0.9, 0.9, 0.9] },
        ],
      },
    },
  },
  {
    test: /скам|лавк|bench/,
    payload: {
      label: "Скамейка",
      description: "Скамейка для зоны отдыха",
      price: 520,
      mesh: {
        primitive: "group",
        color: "#8a5a2b",
        size: [1.7, 0.85, 0.58],
        parts: [
          { primitive: "box", color: "#3f4a55", position: [-0.72, 0.18, 0], size: [0.07, 0.36, 0.5], metalness: 0.7, roughness: 0.35 },
          { primitive: "box", color: "#3f4a55", position: [0.72, 0.18, 0], size: [0.07, 0.36, 0.5], metalness: 0.7, roughness: 0.35 },
          { primitive: "box", color: "#7a4e28", position: [0, 0.38, -0.16], size: [1.62, 0.035, 0.12], roughness: 0.82 },
          { primitive: "box", color: "#8a5a2b", position: [0, 0.38, 0], size: [1.62, 0.035, 0.12], roughness: 0.82 },
          { primitive: "box", color: "#7a4e28", position: [0, 0.38, 0.16], size: [1.62, 0.035, 0.12], roughness: 0.82 },
          { primitive: "box", color: "#3f4a55", position: [-0.72, 0.55, -0.22], size: [0.06, 0.42, 0.06], metalness: 0.7, roughness: 0.35 },
          { primitive: "box", color: "#3f4a55", position: [0.72, 0.55, -0.22], size: [0.06, 0.42, 0.06], metalness: 0.7, roughness: 0.35 },
          { primitive: "box", color: "#8a5a2b", position: [0, 0.62, -0.22], size: [1.62, 0.03, 0.1], roughness: 0.82 },
          { primitive: "box", color: "#7a4e28", position: [0, 0.78, -0.22], size: [1.62, 0.03, 0.1], roughness: 0.82 },
        ],
      },
    },
  },
  {
    test: /фонар|светиль|освещ/,
    payload: {
      label: "Фонарь",
      description: "Опора освещения",
      price: 380,
      mesh: {
        primitive: "group",
        color: "#334155",
        size: [0.55, 3.4, 0.55],
        parts: [
          { primitive: "cylinder", color: "#2a3038", position: [0, 0.06, 0], size: [0.34, 0.12, 0.34], metalness: 0.75, roughness: 0.4 },
          { primitive: "cylinder", color: "#3b4450", position: [0, 1.45, 0], size: [0.09, 2.8, 0.09], metalness: 0.7, roughness: 0.32 },
          { primitive: "cylinder", color: "#2f3640", position: [0, 2.92, 0], size: [0.16, 0.12, 0.16], metalness: 0.7, roughness: 0.3 },
          { primitive: "sphere", color: "#ffe7a8", position: [0, 3.12, 0], size: [0.22, 0.22, 0.22], emissive: "#ffb454", emissiveIntensity: 2.2, roughness: 0.2, opacity: 0.85 },
          { primitive: "cone", color: "#2a3038", position: [0, 3.28, 0], size: [0.28, 0.1, 0.28], metalness: 0.65, roughness: 0.35 },
        ],
      },
    },
  },
  {
    test: /фонтан/,
    payload: {
      label: "Фонтан",
      description: "Декоративный фонтан",
      price: 4100,
      mesh: {
        primitive: "group",
        color: "#64748b",
        size: [2.2, 1.2, 2.2],
        parts: [
          { primitive: "cylinder", color: "#64748b", position: [0, 0.22, 0], size: [2.2, 0.44, 2.2] },
          { primitive: "cylinder", color: "#38bdf8", position: [0, 0.46, 0], size: [1.8, 0.08, 1.8] },
          { primitive: "cylinder", color: "#64748b", position: [0, 0.85, 0], size: [0.28, 0.7, 0.28] },
        ],
      },
    },
  },
  {
    test: /горк|качел|детск|площадк/,
    payload: {
      label: "Детская горка",
      description: "Игровой элемент для двора",
      price: 2800,
      mesh: {
        primitive: "group",
        color: "#f59e0b",
        size: [1.6, 2.2, 3.2],
        parts: [
          { primitive: "box", color: "#2563eb", position: [0, 1.1, -0.9], size: [1.2, 2.2, 0.18] },
          { primitive: "box", color: "#f59e0b", position: [0, 0.7, 0.4], size: [0.7, 0.1, 2.4], rotation: [-0.45, 0, 0] },
          { primitive: "cylinder", color: "#22c55e", position: [0, 0.18, 1.4], size: [0.9, 0.2, 0.9] },
        ],
      },
    },
  },
  {
    test: /киоск|павильон|ларек|ларёк|остановок/,
    payload: {
      label: "Киоск",
      description: "Небольшой павильон",
      price: 6500,
      mesh: {
        primitive: "group",
        color: "#d6b36a",
        size: [2.4, 2.6, 2.2],
        parts: [
          { primitive: "box", color: "#d6b36a", position: [0, 1.1, 0], size: [2.4, 2.2, 2.2] },
          { primitive: "box", color: "#7f1d1d", position: [0, 2.35, 0], size: [2.7, 0.16, 2.5] },
          { primitive: "box", color: "#38bdf8", position: [0, 1.2, 1.12], size: [1.4, 0.9, 0.06] },
        ],
      },
    },
  },
  {
    test: /урн|бак|мусор/,
    payload: {
      label: "Урна",
      description: "Урна для раздельного сбора",
      price: 180,
      mesh: {
        primitive: "cylinder",
        color: "#3c4a3e",
        size: [0.4, 0.7, 0.4],
      },
    },
  },
  {
    test: /клумб|цветник|вазон/,
    payload: {
      label: "Клумба",
      description: "Цветник в вазоне",
      price: 420,
      mesh: {
        primitive: "group",
        color: "#7c3f1a",
        size: [1.2, 0.8, 1.2],
        parts: [
          { primitive: "cylinder", color: "#7c3f1a", position: [0, 0.22, 0], size: [1.2, 0.44, 1.2] },
          { primitive: "sphere", color: "#be185d", position: [0, 0.55, 0], size: [0.9, 0.5, 0.9] },
          { primitive: "sphere", color: "#f59e0b", position: [0.2, 0.62, 0.15], size: [0.35, 0.35, 0.35] },
        ],
      },
    },
  },
];

export function mockGenerateObject(
  prompt: string,
  fromPhoto: boolean
): GeneratedObjectPayload {
  const text = prompt.trim() || (fromPhoto ? "объект с фотографии" : "малая архитектурная форма");
  const hit = KEYWORD_PRESETS.find((k) => k.test.test(text.toLowerCase()));
  const base = hit
    ? hit.payload
    : {
        label: text.slice(0, 32),
        description: fromPhoto
          ? "Объект по загруженному фото (черновик без ключа API)"
          : `Объект по описанию: ${text}`,
        price: 900,
        mesh: {
          primitive: "group" as const,
          color: "#34d399",
          size: [1.4, 1.6, 1.4] as [number, number, number],
          parts: [
            { primitive: "box" as const, color: "#334155", position: [0, 0.15, 0] as [number, number, number], size: [1.4, 0.3, 1.4] as [number, number, number] },
            { primitive: "box" as const, color: "#10b981", position: [0, 0.95, 0] as [number, number, number], size: [1.1, 1.3, 1.1] as [number, number, number] },
            { primitive: "sphere" as const, color: "#6ee7b7", position: [0, 1.75, 0] as [number, number, number], size: [0.55, 0.55, 0.55] as [number, number, number] },
          ],
        },
      };

  return {
    ...base,
    mesh: sanitizeMesh(base.mesh),
    mock: true,
    provider: "mock",
    message: `Добавил «${base.label}» в каталог. Нажмите карточку, чтобы поставить объект на площадку.`,
  };
}

export function parseGeneratedPayload(raw: unknown, fallbackPrompt: string): GeneratedObjectPayload {
  const data = (raw ?? {}) as Record<string, unknown>;
  const label = String(data.label ?? fallbackPrompt ?? "Объект").slice(0, 48) || "Объект";
  const description = String(data.description ?? "").slice(0, 280);
  const price = Math.max(0, Math.round(Number(data.price) || 800));
  const message =
    String(data.message ?? "").trim() ||
    `«${label}» добавлен в каталог. Нажмите карточку, чтобы разместить.`;
  return {
    label,
    description: description || `Сгенерированный объект: ${label}`,
    price,
    message,
    mesh: sanitizeMesh(data.mesh),
  };
}

export function thumbnailFromMesh(mesh: GeneratedMesh, photo?: string | null): string {
  if (photo && photo.startsWith("data:image")) return photo;
  if (typeof document === "undefined") {
    return svgThumb(`<rect x="24" y="24" width="32" height="32" rx="6" fill="${mesh.color}"/>`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, "#10241c");
  g.addColorStop(1, "#07110e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 160);

  const [w, h, d] = mesh.size;
  const maxDim = Math.max(w, h, d, 0.01);
  const scale = 52 / maxDim;
  const bw = w * scale;
  const bh = h * scale;
  const bd = d * scale;
  const cx = 80;
  const cy = 108;
  const color = mesh.color || "#34d399";
  const accent = mesh.accent || "#6ee7b7";

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(cx, cy - bh);
  ctx.lineTo(cx + bw * 0.55, cy - bh * 0.55 - bd * 0.25);
  ctx.lineTo(cx + bw * 0.55, cy + bd * 0.15);
  ctx.lineTo(cx, cy + bh * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - bh);
  ctx.lineTo(cx - bw * 0.55, cy - bh * 0.55 - bd * 0.25);
  ctx.lineTo(cx - bw * 0.55, cy + bd * 0.15);
  ctx.lineTo(cx, cy + bh * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#052e26";
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

export function payloadToCatalogItem(
  payload: GeneratedObjectPayload,
  prompt: string,
  photo?: string | null
): CatalogItem {
  return {
    id: `ai-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    label: payload.label,
    description: payload.description,
    price: payload.price,
    thumbnail: thumbnailFromMesh(payload.mesh, photo),
    source: "ai",
    mesh: payload.mesh,
    prompt,
  };
}
