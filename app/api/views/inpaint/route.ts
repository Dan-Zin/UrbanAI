import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface InpaintBody {
  imageDataUrl?: unknown;
  maskDataUrl?: unknown;
  prompt?: unknown;
}

export async function POST(req: Request) {
  const key = process.env.FAL_KEY || process.env.NEXT_PUBLIC_FAL_API_KEY || "";
  if (!key) return NextResponse.json({ mock: true });

  let body: InpaintBody;
  try {
    body = (await req.json()) as InpaintBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (
    typeof body.imageDataUrl !== "string" ||
    typeof body.maskDataUrl !== "string" ||
    typeof body.prompt !== "string"
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const res = await fetch("https://fal.run/fal-ai/flux-pro/v1/fill", {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: body.prompt,
        image_url: body.imageDataUrl,
        mask_url: body.maskDataUrl,
      }),
    });
    if (!res.ok) return NextResponse.json({ mock: true });
    const data = (await res.json()) as { images?: { url?: string }[] };
    const url = data.images?.[0]?.url;
    if (!url) return NextResponse.json({ mock: true });
    const img = await fetch(url);
    if (!img.ok) return NextResponse.json({ mock: true });
    const buf = Buffer.from(await img.arrayBuffer());
    const mime = img.headers.get("content-type") || "image/jpeg";
    return NextResponse.json({
      mock: false,
      imageDataUrl: `data:${mime};base64,${buf.toString("base64")}`,
    });
  } catch {
    return NextResponse.json({ mock: true });
  }
}
