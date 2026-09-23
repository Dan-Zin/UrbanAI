import { SKETCH_DISCLAIMER, type SiteView, type ViewObjectType } from "@/lib/views";

export interface InpaintResult {
  imageDataUrl: string;
  mock: boolean;
  caption: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

export async function fitDataUrl(dataUrl: string, max = 960): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function rasterMask(
  width: number,
  height: number,
  mask: SiteView["mask"]
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(14, width * 0.045);
  const pts = mask.points.map((p) => ({ x: p.x * width, y: p.y * height }));
  if (mask.kind === "rect" && pts.length >= 2) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    ctx.fillRect(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y)
    );
  } else if (mask.kind === "brush" && pts.length > 0) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  } else if (pts.length >= 3) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  }
  if (mask.excludeWindows) ctx.clearRect(0, 0, width, height * 0.4);
  return canvas;
}

function stampCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  caption: string,
  hypothesis: boolean
) {
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, height - 58, width, 58);
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "bold 16px sans-serif";
  const title = hypothesis ? `гипотеза · ${caption}` : caption;
  ctx.fillText(title, 12, height - 34);
  ctx.font = "13px sans-serif";
  ctx.fillText(SKETCH_DISCLAIMER, 12, height - 14);
}

export async function mockInpaint(opts: {
  imageDataUrl: string;
  mask: SiteView["mask"];
  caption: string;
  hypothesis: boolean;
  stamp?: boolean;
}): Promise<string> {
  const img = await loadImage(opts.imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return opts.imageDataUrl;
  ctx.drawImage(img, 0, 0);
  const mask = rasterMask(img.width, img.height, opts.mask);
  const tint = document.createElement("canvas");
  tint.width = img.width;
  tint.height = img.height;
  const tctx = tint.getContext("2d");
  if (!tctx) return canvas.toDataURL("image/jpeg", 0.82);
  tctx.drawImage(mask, 0, 0);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgba(6, 78, 59, 0.55)";
  tctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(tint, 0, 0);
  tctx.clearRect(0, 0, img.width, img.height);
  tctx.globalCompositeOperation = "source-over";
  tctx.drawImage(mask, 0, 0);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgba(52, 211, 153, 0.38)";
  tctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(tint, 0, 0);
  if (opts.stamp) {
    stampCaption(ctx, img.width, img.height, opts.caption || "демо-эскиз", opts.hypothesis);
  }
  return canvas.toDataURL("image/jpeg", 0.82);
}

const SPRITE: Record<ViewObjectType, string> = {
  bench: "#8a5a2b",
  bin: "#3c4a3e",
  lamp: "#fde68a",
  paving: "#9ca3af",
  greenery: "#15803d",
  parking_pocket: "#334155",
  playground_element: "#f59e0b",
};

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  type: ViewObjectType,
  footX: number,
  footY: number,
  widthPx: number
) {
  const w = Math.max(8, widthPx);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(footX, footY, w * 0.42, Math.max(4, w * 0.1), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SPRITE[type];
  if (type === "paving" || type === "parking_pocket") {
    ctx.globalAlpha = 0.82;
    ctx.fillRect(footX - w / 2, footY - w * 0.22, w, w * 0.44);
  } else if (type === "lamp") {
    ctx.fillRect(footX - w * 0.06, footY - w * 2.1, w * 0.12, w * 2.1);
    ctx.beginPath();
    ctx.arc(footX, footY - w * 2.2, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "greenery") {
    ctx.fillRect(footX - w * 0.06, footY - w * 0.7, w * 0.12, w * 0.7);
    ctx.beginPath();
    ctx.arc(footX, footY - w * 0.95, w * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "bin") {
    ctx.fillRect(footX - w * 0.28, footY - w * 0.7, w * 0.56, w * 0.7);
  } else {
    ctx.fillRect(footX - w / 2, footY - w * 0.28, w, w * 0.16);
    ctx.fillRect(footX - w / 2, footY - w * 0.62, w, w * 0.12);
  }
  ctx.restore();
}

export async function compositeObjects(opts: {
  baseDataUrl: string;
  sprites: { type: ViewObjectType; u: number; v: number; widthPx: number }[];
  caption: string;
  hypothesis: boolean;
}): Promise<string> {
  const img = await loadImage(opts.baseDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return opts.baseDataUrl;
  ctx.drawImage(img, 0, 0);
  for (const sprite of opts.sprites) {
    drawSprite(ctx, sprite.type, sprite.u * img.width, sprite.v * img.height, sprite.widthPx);
  }
  stampCaption(ctx, img.width, img.height, opts.caption, opts.hypothesis);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function refineCaption(label: string): Promise<string> {
  if (!process.env.NEXT_PUBLIC_OPENROUTER_API_KEY) return label;
  try {
    const res = await fetch("/api/views/caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) return label;
    const data = (await res.json()) as { caption?: unknown };
    return typeof data.caption === "string" && data.caption.trim()
      ? data.caption.trim().slice(0, 80)
      : label;
  } catch {
    return label;
  }
}

export async function runInpaint(opts: {
  imageDataUrl: string;
  mask: SiteView["mask"];
  prompt: string;
  caption: string;
  hypothesis: boolean;
}): Promise<InpaintResult> {
  const caption = await refineCaption(opts.caption);
  const keyPresent = Boolean(process.env.NEXT_PUBLIC_FAL_API_KEY);
  if (!keyPresent) {
    return {
      imageDataUrl: await mockInpaint({ ...opts, caption: caption || "демо-эскиз" }),
      mock: true,
      caption: caption || "демо-эскиз",
    };
  }
  try {
    const base = await loadImage(opts.imageDataUrl);
    const maskUrl = rasterMask(base.width, base.height, opts.mask).toDataURL("image/png");
    const res = await fetch("/api/views/inpaint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: opts.imageDataUrl,
        maskDataUrl: maskUrl,
        prompt: opts.prompt,
      }),
    });
    const data = (await res.json()) as { mock?: boolean; imageDataUrl?: string };
    if (!res.ok || data.mock || !data.imageDataUrl) {
      return {
        imageDataUrl: await mockInpaint({ ...opts, caption: caption || "демо-эскиз" }),
        mock: true,
        caption: caption || "демо-эскиз",
      };
    }
    return { imageDataUrl: data.imageDataUrl, mock: false, caption };
  } catch {
    return {
      imageDataUrl: await mockInpaint({ ...opts, caption: caption || "демо-эскиз" }),
      mock: true,
      caption: caption || "демо-эскиз",
    };
  }
}

export function maskCentroid(mask: SiteView["mask"]): { u: number; v: number } {
  if (mask.points.length === 0) return { u: 0.5, v: 0.7 };
  const u = mask.points.reduce((s, p) => s + p.x, 0) / mask.points.length;
  const v = mask.points.reduce((s, p) => s + p.y, 0) / mask.points.length;
  return { u, v };
}
