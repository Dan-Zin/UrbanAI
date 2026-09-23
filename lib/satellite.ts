/**
 * Nadir orthophoto for the 3D ground and roofs.
 * The wide stitch is z20 (about 10 cm/px). Enhancement resamples the center to
 * the GPU texture limit so a close camera does not magnify single pixels.
 */

import * as THREE from "three";

const TILE_URL = (z: number, x: number, y: number) =>
  `/api/sat-tile?z=${z}&x=${x}&y=${y}`;

const TILE_PX = 256;

export interface GroundDetail {
  texture: THREE.CanvasTexture;
  /** Side length of this sharper square, meters. Same center as the wide photo. */
  size: number;
}

export interface GroundImagery {
  texture: THREE.CanvasTexture;
  /** Side length of the covered square, meters. */
  size: number;
  enhanced?: boolean;
  /** Wide photo, or a high-resolution center patch on top of it. */
  provider?: "raw" | "detail";
  /** Sharper orthophoto of the center. Null on the fast wide stitch. */
  detail?: GroundDetail;
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TILE_URL(z, x, y);
  });
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** World-coord mapping shared by the ground quad and roof materials. */
export function applyGroundMapping(t: THREE.Texture, size: number) {
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.repeat.set(1 / size, 1 / size);
  t.offset.set(0.5, 0.5);
  return t;
}

function toTexture(canvas: HTMLCanvasElement, size: number, enhanced: boolean): GroundImagery {
  const texture = new THREE.CanvasTexture(canvas);
  applyGroundMapping(texture, size);
  return { texture, size, enhanced };
}

async function stitchTiles(
  lng: number,
  lat: number,
  zoom: number,
  gridTiles: number
): Promise<{ canvas: HTMLCanvasElement; size: number; loaded: number } | null> {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * TILE_PX;
  const py =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n *
    TILE_PX;

  const half = (gridTiles * TILE_PX) / 2;
  const x0 = Math.floor((px - half) / TILE_PX);
  const y0 = Math.floor((py - half) / TILE_PX);
  const shiftX = px - half - x0 * TILE_PX;
  const shiftY = py - half - y0 * TILE_PX;

  const canvasSize = gridTiles * TILE_PX;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a1210";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const jobs: { dx: number; dy: number }[] = [];
  for (let dx = 0; dx <= gridTiles; dx++) {
    for (let dy = 0; dy <= gridTiles; dy++) {
      jobs.push({ dx, dy });
    }
  }

  let loaded = 0;
  await pool(jobs, 12, async ({ dx, dy }) => {
    const img = await loadTile(zoom, x0 + dx, y0 + dy);
    if (!img) return;
    loaded++;
    ctx.drawImage(img, dx * TILE_PX - shiftX, dy * TILE_PX - shiftY);
  });

  if (loaded === 0) return null;
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / n;
  return { canvas, size: canvasSize * metersPerPixel, loaded };
}

export async function loadGroundImagery(
  lng: number,
  lat: number
): Promise<GroundImagery | null> {
  // 16*256 = 4096. z20 ≈ 0.1 m/px at Taganrog → ~410 m square.
  const hi = await stitchTiles(lng, lat, 20, 16);
  if (hi && hi.loaded >= 80) {
    return toTexture(hi.canvas, hi.size, false);
  }
  const mid = await stitchTiles(lng, lat, 19, 16);
  if (mid && mid.loaded >= 80) {
    return toTexture(mid.canvas, mid.size, false);
  }
  const lo =
    (await stitchTiles(lng, lat, 19, 8)) ??
    (await stitchTiles(lng, lat, 18, 8)) ??
    (hi && hi.loaded > 0 ? hi : null) ??
    (mid && mid.loaded > 0 ? mid : null);
  if (!lo) return null;
  return toTexture(lo.canvas, lo.size, false);
}

function sourceToCanvas(image: unknown): HTMLCanvasElement | null {
  if (image instanceof HTMLCanvasElement) return image;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    c.getContext("2d")!.drawImage(image, 0, 0);
    return c;
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    const c = document.createElement("canvas");
    c.width = image.naturalWidth || image.width;
    c.height = image.naturalHeight || image.height;
    c.getContext("2d")!.drawImage(image, 0, 0);
    return c;
  }
  return null;
}

/** Center square that gets the high-resolution patch, meters. */
const DETAIL_METERS = 120;
/** Power-of-two cap. Lowered when the GPU cannot sample 8192². */
const DETAIL_PX = 8192;

function maxTextureSize() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  const max = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 4096;
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  return Math.max(2048, Math.min(DETAIL_PX, max || 4096));
}

function lanczos(x: number, a = 3) {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= a) return 0;
  const pix = Math.PI * x;
  return (a * Math.sin(pix) * Math.sin(pix / a)) / (pix * pix);
}

function cropCenter(src: HTMLCanvasElement, side: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const sx = Math.floor((src.width - side) / 2);
  const sy = Math.floor((src.height - side) / 2);
  canvas.getContext("2d")!.drawImage(src, sx, sy, side, side, 0, 0, side, side);
  return canvas;
}

/** Separable Lanczos-3. Adds real samples so a zoomed view is not a grid of blocks. */
async function resampleLanczos(
  src: HTMLCanvasElement,
  dw: number,
  dh: number,
  signal?: AbortSignal
): Promise<HTMLCanvasElement> {
  const sw = src.width;
  const sh = src.height;
  const srcData = src.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  const a = 3;
  const tmp = new Float32Array(dw * sh * 4);
  const scaleX = sw / dw;

  for (let x = 0; x < dw; x++) {
    if ((x & 63) === 0) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      await new Promise((r) => setTimeout(r, 0));
    }
    const srcX = (x + 0.5) * scaleX - 0.5;
    const xBase = Math.floor(srcX);
    for (let y = 0; y < sh; y++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let k = xBase - a + 1; k <= xBase + a; k++) {
        const ck = Math.max(0, Math.min(sw - 1, k));
        const w = lanczos(srcX - k, a);
        const i = (y * sw + ck) * 4;
        r += srcData[i] * w;
        g += srcData[i + 1] * w;
        b += srcData[i + 2] * w;
        wsum += w;
      }
      const o = (y * dw + x) * 4;
      const inv = wsum || 1;
      tmp[o] = r / inv;
      tmp[o + 1] = g / inv;
      tmp[o + 2] = b / inv;
    }
  }

  const out = document.createElement("canvas");
  out.width = dw;
  out.height = dh;
  const ctx = out.getContext("2d")!;
  const dst = ctx.createImageData(dw, dh);
  const d = dst.data;
  const scaleY = sh / dh;
  const fade = Math.max(12, Math.round(Math.min(dw, dh) * 0.04));

  for (let y = 0; y < dh; y++) {
    if ((y & 15) === 0) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      await new Promise((r) => setTimeout(r, 0));
    }
    const srcY = (y + 0.5) * scaleY - 0.5;
    const yBase = Math.floor(srcY);
    const edgeY = Math.min(y, dh - 1 - y);
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let k = yBase - a + 1; k <= yBase + a; k++) {
        const ck = Math.max(0, Math.min(sh - 1, k));
        const w = lanczos(srcY - k, a);
        const i = (ck * dw + x) * 4;
        r += tmp[i] * w;
        g += tmp[i + 1] * w;
        b += tmp[i + 2] * w;
        wsum += w;
      }
      const inv = wsum || 1;
      const edge = Math.min(edgeY, x, dw - 1 - x);
      const o = (y * dw + x) * 4;
      d[o] = Math.max(0, Math.min(255, r / inv));
      d[o + 1] = Math.max(0, Math.min(255, g / inv));
      d[o + 2] = Math.max(0, Math.min(255, b / inv));
      d[o + 3] = edge >= fade ? 255 : Math.round((255 * edge) / fade);
    }
  }
  ctx.putImageData(dst, 0, 0);
  return out;
}

/** Crisp the new samples. Radius stays under a pixel so blocks do not come back. */
function sharpen(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const blur = document.createElement("canvas");
  blur.width = w;
  blur.height = h;
  const bctx = blur.getContext("2d");
  const sctx = src.getContext("2d");
  if (!bctx || !sctx) return src;
  bctx.filter = "blur(0.7px)";
  bctx.drawImage(src, 0, 0);
  const base = sctx.getImageData(0, 0, w, h);
  const soft = bctx.getImageData(0, 0, w, h);
  const d = base.data;
  const b = soft.data;
  const amount = 0.72;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c] + (d[i + c] - b[i + c]) * amount;
      d[i + c] = Math.max(0, Math.min(255, v));
    }
  }
  sctx.putImageData(base, 0, 0);
  return src;
}

function paintDetail(canvas: HTMLCanvasElement, meters: number): GroundDetail {
  const texture = new THREE.CanvasTexture(canvas);
  applyGroundMapping(texture, meters);
  texture.premultiplyAlpha = false;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, size: meters };
}

const enhanceCache = new Map<string, { canvas: HTMLCanvasElement; meters: number }>();

/**
 * The wide stitch is ~10 cm/px, so a close camera magnifies each sample into a block.
 * Satellite sources for Taganrog stop at z20, so the center 120 m is resampled to 8192²
 * (~1.5 cm/px) and laid over the wide photo.
 */
export async function enhanceGroundImagery(
  imagery: GroundImagery,
  opts?: { signal?: AbortSignal; cacheKey?: string }
): Promise<GroundImagery> {
  const source = sourceToCanvas(imagery.texture.image);
  if (!source || source.width < 2 || source.height < 2) return imagery;

  const key = opts?.cacheKey;
  const cached = key ? enhanceCache.get(key) : undefined;
  if (cached) {
    return {
      texture: imagery.texture,
      size: imagery.size,
      enhanced: true,
      provider: "detail",
      detail: paintDetail(cached.canvas, cached.meters),
    };
  }

  const metersPerPixel = imagery.size / source.width;
  const wantPx = Math.round(DETAIL_METERS / metersPerPixel);
  const side = Math.max(32, Math.min(source.width, source.height, wantPx));
  const meters = side * metersPerPixel;
  const crop = cropCenter(source, side);
  const outPx = Math.max(side, maxTextureSize());
  const canvas = sharpen(await resampleLanczos(crop, outPx, outPx, opts?.signal));
  if (key) enhanceCache.set(key, { canvas, meters });
  return {
    texture: imagery.texture,
    size: imagery.size,
    enhanced: true,
    provider: "detail",
    detail: paintDetail(canvas, meters),
  };
}
