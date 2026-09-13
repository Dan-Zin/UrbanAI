/**
 * Urban AI — service layer.
 *
 * Every function runs in MOCK MODE automatically when its API key is missing,
 * so the demo works out of the box. Drop keys into .env.local to go live:
 *
 *   NEXT_PUBLIC_OPENROUTER_API_KEY  — NLP sentiment analysis (OpenRouter)
 *   NEXT_PUBLIC_FAL_API_KEY         — generative renders (Fal.ai)
 *   NEXT_PUBLIC_TRIPO_API_KEY       — text-to-3D assets (Tripo AI, placeholder)
 */

import type { ComplianceResult, PlacedObject, SentimentResult } from "@/lib/store";
import { seededRandom } from "@/lib/utils";
import {
  CATALOG_SYSTEM_PROMPT,
  parseGeneratedPayload,
  type GeneratedObjectPayload,
} from "@/lib/catalog";

const OPENROUTER_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
const FAL_KEY = process.env.NEXT_PUBLIC_FAL_API_KEY ?? "";
const TRIPO_KEY = process.env.NEXT_PUBLIC_TRIPO_API_KEY ?? "";
const MAPILLARY_TOKEN = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "";

export const MOCK_MODE = {
  nlp: !OPENROUTER_KEY,
  image: !FAL_KEY,
  model3d: !TRIPO_KEY,
  photo: !MAPILLARY_TOKEN,
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Claude via some providers wraps JSON in ```json fences — strip them. */
function parseModelJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/* ------------------------------------------------------------------ */
/* Pillar 1 — NLP Analysis (OpenRouter)                                */
/* ------------------------------------------------------------------ */

const MOCK_CATEGORIES = [
  {
    category: "Парк и озеленение",
    summary:
      "Жители этого квартала просят больше тени, скамеек и небольшой сквер. Пешеходный поток сильнее вечером.",
    requests: [
      { label: "Сквер", count: 34 },
      { label: "Скамейки", count: 21 },
      { label: "Площадка", count: 12 },
    ],
  },
  {
    category: "Ремонт дорог",
    summary:
      "В отзывах преобладают жалобы на покрытие и слабое освещение пешеходных маршрутов.",
    requests: [
      { label: "Ремонт дороги", count: 41 },
      { label: "Освещение", count: 18 },
      { label: "Переход", count: 9 },
    ],
  },
  {
    category: "Общественный транспорт",
    summary:
      "Пассажиры просят крытую остановку и удобные связи к набережной и улице Петровской.",
    requests: [
      { label: "Павильон", count: 27 },
      { label: "Новый маршрут", count: 15 },
      { label: "Велодорожка", count: 11 },
    ],
  },
  {
    category: "Выход к воде",
    summary:
      "Позитивный запрос: лестницы к берегу, смотровые площадки на залив и вечерний свет.",
    requests: [
      { label: "Спуск к морю", count: 29 },
      { label: "Смотровая", count: 17 },
      { label: "Освещение", count: 10 },
    ],
  },
];

export async function analyzeSentiment(
  lng: number,
  lat: number
): Promise<SentimentResult> {
  if (MOCK_MODE.nlp) {
    await delay(900 + Math.random() * 600);
    const rand = seededRandom(lng * 7.77 + lat * 3.33);
    const pick = MOCK_CATEGORIES[Math.floor(rand() * MOCK_CATEGORIES.length)];
    const score = 0.35 + rand() * 0.6;
    return {
      category: pick.category,
      sentiment: score > 0.62 ? "positive" : score > 0.45 ? "neutral" : "negative",
      score: Math.round(score * 100) / 100,
      topRequests: pick.requests,
      summary: pick.summary,
    };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4.5",
      messages: [
        {
          role: "system",
          content:
            "Ты — NLP-движок городского планирования. Все текстовые поля — на русском. " +
            "По координатам в Таганроге верни СТРОГИЙ JSON: " +
            '{"category": string, "sentiment": "positive"|"neutral"|"negative", "score": number 0..1, ' +
            '"topRequests": [{"label": string, "count": number}], "summary": string}. ' +
            "Категория — доминирующий запрос жителей (сквер, ремонт дороги, транспорт и т.д.).",
        },
        {
          role: "user",
          content: `Разбери настроения жителей для точки lng=${lng}, lat=${lat}. Ответ на русском.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return parseModelJson<SentimentResult>(data.choices[0].message.content);
}

/* ------------------------------------------------------------------ */
/* Pillar 2 — Generative Design (Fal.ai)                               */
/* ------------------------------------------------------------------ */

/** Builds a procedural SVG "AI render" so mock mode needs no network. */
function mockRender(prompt: string): string {
  const rand = seededRandom(
    prompt.split("").reduce((a, c) => a + c.charCodeAt(0), 1) / 1000
  );
  const blocks = Array.from({ length: 7 }, (_, i) => {
    const h = 40 + rand() * 160;
    const x = 20 + i * 90 + rand() * 30;
    return `<rect x="${x}" y="${330 - h}" width="${50 + rand() * 30}" height="${h}" rx="3" fill="rgba(16,185,129,${0.15 + rand() * 0.3})" stroke="rgba(110,231,183,0.5)"/>`;
  }).join("");
  const trees = Array.from({ length: 9 }, () => {
    const x = 20 + rand() * 620;
    const r = 8 + rand() * 14;
    return `<circle cx="${x}" cy="${340 - r * 0.4}" r="${r}" fill="rgba(52,211,153,${0.35 + rand() * 0.4})"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="672" height="378" viewBox="0 0 672 378">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#02120c"/>
        <stop offset="0.7" stop-color="#042f22"/><stop offset="1" stop-color="#0a5c40"/>
      </linearGradient>
    </defs>
    <rect width="672" height="378" fill="url(#sky)"/>
    <circle cx="560" cy="80" r="34" fill="rgba(167,243,208,0.85)"/>
    ${blocks}${trees}
    <rect y="340" width="672" height="38" fill="#03271c"/>
    <text x="24" y="364" font-family="monospace" font-size="13" fill="rgba(167,243,208,0.8)">URBAN AI RENDER · ${prompt.slice(0, 52).replace(/[<>&]/g, "")}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function generateVisualization(prompt: string): Promise<string> {
  if (MOCK_MODE.image) {
    await delay(1600 + Math.random() * 900);
    return mockRender(prompt);
  }

  // Fal.ai — FLUX text-to-image (synchronous endpoint)
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `Photorealistic urban design render, Taganrog Russia, golden hour: ${prompt}`,
      image_size: "landscape_16_9",
    }),
  });
  if (!res.ok) throw new Error(`Fal.ai error ${res.status}`);
  const data = await res.json();
  return data.images[0].url as string;
}

/* ------------------------------------------------------------------ */
/* Pillar 2a-2 — Neural scene reconstruction                           */
/* photo -> vision model -> structured facade + street description     */
/* ------------------------------------------------------------------ */

export interface FacadeSpec {
  material: "brick" | "panel" | "plaster" | "wood" | "stone";
  /** main facade colour, hex */
  color: string;
  /** window surrounds / cornices / capitals colour, hex */
  trimColor: string;
  windowShape: "rect" | "arched";
  /** classical portico / pilasters on the facade */
  columns: boolean;
  corniceBands: boolean;
}

export interface StreetSpec {
  benches: number;
  bins: number;
  fence: boolean;
  extraTrees: number;
}

export interface SceneAnalysis {
  facade: FacadeSpec;
  street: StreetSpec;
  source: "photo" | "heuristic";
}

/** Heuristic reconstruction when no photo/vision key is available.
 *  Tuned to Taganrog: public/edu buildings are red brick with columns
 *  and arched windows; the old center is pastel plaster with cornices. */
function mockSceneAnalysis(kind: string, levels: number, seed: number): SceneAnalysis {
  const rand = seededRandom(seed * 0.71 + 4.2);
  if (/^(university|college|school|public|civic|government|church)$/.test(kind)) {
    return {
      facade: {
        material: "brick",
        color: "#8f3a2a",
        trimColor: "#e9e1d1",
        windowShape: "arched",
        columns: true,
        corniceBands: true,
      },
      street: { benches: 3, bins: 2, fence: true, extraTrees: 2 },
      source: "heuristic",
    };
  }
  if (kind === "apartments" || levels >= 4) {
    return {
      facade: {
        material: levels >= 6 ? "panel" : "brick",
        color: levels >= 6 ? "#b7b3ab" : "#9c5744",
        trimColor: "#d9d5cc",
        windowShape: "rect",
        columns: false,
        corniceBands: false,
      },
      street: { benches: 2, bins: 1, fence: false, extraTrees: 1 },
      source: "heuristic",
    };
  }
  const pastel = ["#d9b96c", "#e6d7ae", "#d9a89a", "#bccaa9"][
    Math.floor(rand() * 4)
  ];
  return {
    facade: {
      material: "plaster",
      color: pastel,
      trimColor: "#f2efe4",
      windowShape: rand() < 0.3 ? "arched" : "rect",
      columns: false,
      corniceBands: true,
    },
    street: { benches: 1, bins: 1, fence: rand() < 0.5, extraTrees: 1 },
    source: "heuristic",
  };
}

/**
 * Vision analysis of a street photo -> structured facade & street spec.
 * Real mode uses an OpenRouter vision model; falls back to heuristics.
 */
export async function analyzeStreetScene(opts: {
  photoUrl: string | null;
  kind: string;
  levels: number;
  seed: number;
}): Promise<SceneAnalysis> {
  if (MOCK_MODE.nlp || !opts.photoUrl) {
    await delay(1100 + Math.random() * 700);
    return mockSceneAnalysis(opts.kind, opts.levels, opts.seed);
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4.5",
      messages: [
        {
          role: "system",
          content:
            "Ты разбираешь уличные фото российских зданий для 3D-реконструкции. Верни СТРОГИЙ JSON: " +
            '{"facade":{"material":"brick|panel|plaster|wood|stone","color":"#hex","trimColor":"#hex",' +
            '"windowShape":"rect|arched","columns":bool,"corniceBands":bool},' +
            '"street":{"benches":int,"bins":int,"fence":bool,"extraTrees":int}}. ' +
            "Estimate counts of visible street furniture near the building.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Опиши фасад этого здания и объекты у входа. JSON без комментариев." },
            { type: "image_url", image_url: { url: opts.photoUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    // key without credits / model unavailable — degrade to heuristics
    return mockSceneAnalysis(opts.kind, opts.levels, opts.seed);
  }
  try {
    const data = await res.json();
    const parsed = parseModelJson<Omit<SceneAnalysis, "source">>(
      data.choices[0].message.content
    );
    if (!parsed.facade || !parsed.street) throw new Error("bad shape");
    return { ...parsed, source: "photo" };
  } catch {
    return mockSceneAnalysis(opts.kind, opts.levels, opts.seed);
  }
}

/* ------------------------------------------------------------------ */
/* Pillar 2a — Neural facade textures (Mapillary photo -> Fal.ai)      */
/* ------------------------------------------------------------------ */

/**
 * Nearest photo of a location. Tries street-level Mapillary first (token
 * required), then Wikimedia Commons geosearch (no key, great architecture
 * coverage in Russian cities). Returns null if nothing is found nearby.
 */
export async function findFacadePhoto(
  lng: number,
  lat: number
): Promise<string | null> {
  // 1) Mapillary street-level imagery
  if (!MOCK_MODE.photo) {
    try {
      const d = 0.0007; // ~60 m search box
      const url =
        `https://graph.mapillary.com/images?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}` +
        `&fields=id,thumb_1024_url&limit=1` +
        `&bbox=${lng - d},${lat - d},${lng + d},${lat + d}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const found = json.data?.[0]?.thumb_1024_url;
        if (found) return found;
      }
    } catch {
      /* fall through to Commons */
    }
  }

  // 2) Wikimedia Commons photos within ~120 m (File namespace, CORS-enabled)
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch` +
      `&ggscoord=${lat}%7C${lng}&ggsradius=120&ggslimit=3&ggsnamespace=6` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=1024&format=json&origin=*`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const pages = json.query?.pages
        ? (Object.values(json.query.pages) as {
            imageinfo?: { thumburl?: string; url?: string }[];
          }[])
        : [];
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (info?.thumburl || info?.url) return info.thumburl ?? info.url ?? null;
      }
    }
  } catch {
    /* no photo source available */
  }
  return null;
}

/** Mock facade texture: weathered pastel plaster with lit windows (no keys needed). */
function mockFacadeDataUrl(seed: number): string {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = seededRandom(seed * 0.37 + 1.9);
  const palette = ["#d9b96c", "#e0cfa0", "#d9a89a", "#bccaa9", "#ded8cb"];
  const base = palette[Math.floor(rand() * palette.length)];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // weathering
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? "60,50,40" : "255,255,255"},${0.02 + rand() * 0.05})`;
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 26, 2 + rand() * 12);
  }
  // windows with trim
  const cell = size / 4;
  for (let cx = 0; cx < 4; cx++) {
    for (let cy = 0; cy < 4; cy++) {
      const x = cx * cell + cell * 0.3;
      const y = cy * cell + cell * 0.24;
      const w = cell * 0.4;
      const h = cell * 0.5;
      ctx.fillStyle = "rgba(245,242,230,0.9)";
      ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
      ctx.fillStyle = rand() < 0.3 ? "#e8d9a8" : "#1d232b";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  }
  return canvas.toDataURL("image/png");
}

/**
 * Generate a tileable facade texture. With keys: Mapillary photo is fed to
 * FLUX image-to-image; without a photo, text-to-image; without Fal.ai, mock.
 */
export async function generateFacadeTexture(opts: {
  photoUrl: string | null;
  kind: string;
  levels: number;
  seed: number;
}): Promise<string> {
  if (MOCK_MODE.image) {
    await delay(1400 + Math.random() * 700);
    return mockFacadeDataUrl(opts.seed);
  }

  const prompt =
    `seamless tileable building facade texture, flat orthographic front view, ` +
    `${opts.levels}-storey ${opts.kind} building in Taganrog Russia, ` +
    `realistic plaster or brick, windows grid, photorealistic, no perspective, no sky, no ground`;

  const endpoint = opts.photoUrl
    ? "https://fal.run/fal-ai/flux/dev/image-to-image"
    : "https://fal.run/fal-ai/flux/schnell";
  const body = opts.photoUrl
    ? { image_url: opts.photoUrl, prompt, strength: 0.6, image_size: "square" }
    : { prompt, image_size: "square" };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fal.ai error ${res.status}`);
  const data = await res.json();
  return data.images[0].url as string;
}

/* ------------------------------------------------------------------ */
/* Pillar 2b — Text-to-3D (Tripo AI placeholder)                       */
/* ------------------------------------------------------------------ */

export async function generate3DAsset(
  prompt: string
): Promise<{ label: string; price: number }> {
  if (MOCK_MODE.model3d) {
    await delay(1200);
    return { label: `ИИ: ${prompt.slice(0, 24)}`, price: 1500 };
  }
  // Tripo AI integration point — create a task, poll, return a GLB url.
  // https://platform.tripo3d.ai/docs
  const res = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TRIPO_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "text_to_model", prompt }),
  });
  if (!res.ok) throw new Error(`Tripo error ${res.status}`);
  return { label: `ИИ: ${prompt.slice(0, 24)}`, price: 1500 };
}

/* ------------------------------------------------------------------ */
/* Catalog objects — OpenRouter from the browser (same key as NLP)     */
/* ------------------------------------------------------------------ */

export async function generateCatalogObject(
  prompt: string,
  image: string | null
): Promise<GeneratedObjectPayload> {
  if (OPENROUTER_KEY) {
    const userText = image
      ? `По фото собери детальную модель (12–24 части, материалы дерева/металла/стекла, мелкие детали). Описание: ${prompt || "объект с фото"}`
      : `Собери детальную реалистичную модель для каталога (12–24 части, не упрощай): ${prompt}`;
    const content = image
      ? [
          { type: "text" as const, text: userText },
          { type: "image_url" as const, image_url: { url: image } },
        ]
      : userText;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
          "X-Title": "Urban AI",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4.5",
          messages: [
            { role: "system", content: CATALOG_SYSTEM_PROMPT },
            { role: "user", content },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content;
        if (typeof raw === "string" && raw.trim()) {
          const payload = parseGeneratedPayload(parseModelJson(raw), prompt);
          return { ...payload, mock: false, provider: "openrouter" };
        }
      }
    } catch {
      /* fall through to the server route (xAI / mock) */
    }
  }

  const res = await fetch("/api/generate-object", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image }),
  });
  const data = (await res.json()) as GeneratedObjectPayload & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "fail");
  return {
    ...parseGeneratedPayload(data, prompt),
    mock: data.mock,
    provider: data.provider,
  };
}

/* ------------------------------------------------------------------ */
/* Pillar 4 — Compliance AI (mock GIS layer check)                     */
/* ------------------------------------------------------------------ */

const GIS_LAYERS = [
  "Подземные коммуникации",
  "Водопровод",
  "Охранная зона (старый Таганрог)",
  "Газопроводы",
];

export async function checkCompliance(
  objects: PlacedObject[],
  lng: number,
  lat: number
): Promise<ComplianceResult> {
  await delay(700 + Math.random() * 500);
  const rand = seededRandom(lng * 5.5 + lat * 9.9 + objects.length);
  const layers = GIS_LAYERS.map((name) => ({
    name,
    // deeper objects (fountains) are more likely to clash with utilities
    ok: rand() > (objects.some((o) => o.kind === "fountain") ? 0.3 : 0.12),
  }));
  const failed = layers.filter((l) => !l.ok);
  return failed.length === 0
    ? {
        status: "clear",
        message: "Все слои GIS свободны — размещение допустимо",
        layers,
      }
    : {
        status: "warning",
        message: `Конфликт: ${failed.map((f) => f.name).join(", ")}`,
        layers,
      };
}
