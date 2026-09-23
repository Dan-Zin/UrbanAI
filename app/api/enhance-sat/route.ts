import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPT =
  "Enhance this nadir satellite orthophoto. Keep the exact same framing, scale, rotation and every building, road, tree and shoreline in the same place. Do not crop, zoom, add labels, people, or new objects. Recover roof texture, road edges and natural color. Photorealistic top-down satellite image, square.";

function extractImage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.url === "string") return record.url;
  if (typeof record.b64_json === "string") {
    return `data:image/png;base64,${record.b64_json}`;
  }
  if (Array.isArray(record.data) && record.data[0] && typeof record.data[0] === "object") {
    const row = record.data[0] as Record<string, unknown>;
    if (typeof row.url === "string") return row.url;
    if (typeof row.b64_json === "string") return `data:image/png;base64,${row.b64_json}`;
  }
  if (record.image && typeof record.image === "object") {
    const image = record.image as Record<string, unknown>;
    if (typeof image.url === "string") return image.url;
  }
  return null;
}

async function toDataUrl(ref: string): Promise<string | null> {
  if (ref.startsWith("data:image")) return ref;
  const res = await fetch(ref);
  if (!res.ok) return null;
  const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32) return null;
  return `data:${type};base64,${buf.toString("base64")}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { image?: unknown };
    const image = body.image;
    const key = process.env.XAI_API_KEY;
    if (!key || typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "no-enhance" }, { status: 503 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50000);
    try {
      const res = await fetch("https://api.x.ai/v1/images/edits", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "grok-imagine-image-2.0",
          prompt: PROMPT,
          image: { url: image, type: "image_url" },
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        return NextResponse.json({ error: "upstream" }, { status: 502 });
      }
      const ref = extractImage(payload);
      if (!ref) return NextResponse.json({ error: "no-image" }, { status: 502 });
      const dataUrl = await toDataUrl(ref);
      if (!dataUrl) return NextResponse.json({ error: "fetch-image" }, { status: 502 });
      return NextResponse.json({ image: dataUrl, provider: "xai" });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
}
