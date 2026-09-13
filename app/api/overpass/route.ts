import { NextResponse } from "next/server";
import { OSM_RADIUS_M } from "@/lib/constants";
import { querySurroundings } from "@/services/osm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lng?: unknown;
      lat?: unknown;
      radius?: unknown;
    };
    const lng = Number(body.lng);
    const lat = Number(body.lat);
    const radius = Number(body.radius) || OSM_RADIUS_M;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ error: "bad coords" }, { status: 400 });
    }
    const data = await querySurroundings(lng, lat, radius);
    if (!data) {
      return NextResponse.json({ error: "overpass unavailable" }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "overpass failed" }, { status: 500 });
  }
}
