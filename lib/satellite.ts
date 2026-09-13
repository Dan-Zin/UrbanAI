/**
 * Real satellite orthophoto for the scene ground and building roofs.
 * Stitches ESRI World Imagery tiles (z18, ~0.4 m/px at Taganrog's latitude)
 * around the selected point into one texture mapped onto local meters.
 *
 * Mapping convention: geometries built from footprint shapes use vertex
 * coords (x, -z) in meters, so a texture with repeat=1/size, offset=0.5
 * projects world position -> orthophoto exactly (north = canvas top).
 */

import * as THREE from "three";

const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export interface GroundImagery {
  texture: THREE.CanvasTexture;
  /** Side length of the covered square, meters. */
  size: number;
}

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TILE_URL(z, x, y);
  });
}

/** World-coord mapping shared by the ground quad and roof materials. */
export function applyGroundMapping(t: THREE.Texture, size: number) {
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(1 / size, 1 / size);
  t.offset.set(0.5, 0.5);
  return t;
}

export async function loadGroundImagery(
  lng: number,
  lat: number,
  zoom = 18,
  gridTiles = 4
): Promise<GroundImagery | null> {
  const n = 2 ** zoom;
  // global pixel position of the point (256px tiles, web mercator)
  const latRad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * 256;
  const py =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n *
    256;

  const half = (gridTiles * 256) / 2;
  const x0 = Math.floor((px - half) / 256);
  const y0 = Math.floor((py - half) / 256);
  // sub-tile shift so the point sits exactly at the canvas center
  const shiftX = px - half - x0 * 256;
  const shiftY = py - half - y0 * 256;

  const canvasSize = gridTiles * 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0a1210";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const jobs: Promise<void>[] = [];
  let loaded = 0;
  for (let dx = 0; dx <= gridTiles; dx++) {
    for (let dy = 0; dy <= gridTiles; dy++) {
      jobs.push(
        loadTile(zoom, x0 + dx, y0 + dy).then((img) => {
          if (!img) return;
          loaded++;
          ctx.drawImage(img, dx * 256 - shiftX, dy * 256 - shiftY);
        })
      );
    }
  }
  await Promise.all(jobs);
  if (loaded === 0) return null;

  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / n;
  const texture = new THREE.CanvasTexture(canvas);
  const size = canvasSize * metersPerPixel;
  applyGroundMapping(texture, size);
  return { texture, size };
}
