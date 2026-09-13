import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Old clients still POST here. Enhancement now runs in the browser — echo the
 *  original so the Network tab is 200 instead of 502. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { image?: unknown };
    if (typeof body.image === "string" && body.image.startsWith("data:image")) {
      return NextResponse.json({ image: body.image, provider: "client" });
    }
    return NextResponse.json({ error: "need image" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
}
