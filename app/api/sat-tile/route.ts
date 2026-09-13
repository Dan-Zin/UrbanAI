import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Source = {
  name: string;
  url: (z: number, x: number, y: number) => string;
  minBytes: number;
  headers?: Record<string, string>;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SOURCES: Source[] = [
  {
    name: "google",
    url: (z, x, y) =>
      `https://mt1.google.com/vt/lyrs=s&hl=ru&x=${x}&y=${y}&z=${z}`,
    minBytes: 800,
    headers: { Referer: "https://www.google.com/" },
  },
  {
    name: "esri",
    url: (z, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    minBytes: 7000,
  },
  {
    name: "esri2",
    url: (z, x, y) =>
      `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    minBytes: 7000,
  },
  {
    name: "eox",
    url: (z, x, y) =>
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/${z}/${y}/${x}.jpg`,
    minBytes: 800,
  },
];

async function fetchTile(
  url: string,
  minBytes: number,
  extra?: Record<string, string>
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/jpeg,image/png,image/*",
        ...extra,
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < minBytes) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const z = Number(searchParams.get("z"));
  const x = Number(searchParams.get("x"));
  const y = Number(searchParams.get("y"));
  if (![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z > 20) {
    return new NextResponse("bad tile", { status: 400 });
  }

  const order =
    z >= 19
      ? SOURCES
      : [SOURCES[1], SOURCES[2], SOURCES[0], SOURCES[3]];

  for (const src of order) {
    const buf = await fetchTile(src.url(z, x, y), src.minBytes, src.headers);
    if (!buf) continue;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  return new NextResponse("no imagery", { status: 404 });
}
