export interface PlanePoint {
  x: number;
  y: number;
}

/** Row-major 3×3 homography. Maps source plane → image. */
export type Homography = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null;
    const hold = m[col];
    m[col] = m[pivot];
    m[pivot] = hold;
    const div = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let c = col; c <= n; c++) m[row][c] -= factor * m[col][c];
    }
  }
  return m.map((row) => row[n]);
}

/**
 * 4 image clicks are the corners of a 1×1 m ground square, in order:
 * near-left, near-right, far-right, far-left.
 * 3 clicks use an affine map of the same near edge and a point one meter "into" the yard.
 * Returns null when the clicks are degenerate — the caller must not invent a scale.
 */
export function homographyUnitSquare(image: PlanePoint[]): Homography | null {
  if (image.length < 4) return null;
  const src = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const u = image[i].x;
    const v = image[i].y;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    rhs.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    rhs.push(v);
  }
  const h = solve(rows, rhs);
  if (!h || h.length < 8) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(h: Homography, p: PlanePoint): PlanePoint | null {
  const x = h[0] * p.x + h[1] * p.y + h[2];
  const y = h[3] * p.x + h[4] * p.y + h[5];
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-8) return null;
  return { x: x / w, y: y / w };
}

function affine3(src: PlanePoint[], dst: number[]): [number, number, number] | null {
  const rows = src.map((p) => [p.x, p.y, 1]);
  const solved = solve(rows, dst);
  if (!solved || solved.length < 3) return null;
  return [solved[0], solved[1], solved[2]];
}

/** Pixel width of an object `widthM` meters wide along the near edge of the marked ground. */
export function objectWidthPx(imagePoints: PlanePoint[], widthM: number): number | null {
  if (!Number.isFinite(widthM) || widthM <= 0) return null;
  if (imagePoints.length >= 4) {
    const h = homographyUnitSquare(imagePoints.slice(0, 4));
    if (!h) return null;
    const a = applyHomography(h, { x: 0, y: 0 });
    const b = applyHomography(h, { x: widthM, y: 0 });
    if (!a || !b) return null;
    const width = Math.hypot(b.x - a.x, b.y - a.y);
    return Number.isFinite(width) && width > 1 ? width : null;
  }
  if (imagePoints.length === 3) {
    const src = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const ax = affine3(src, imagePoints.map((p) => p.x));
    const ay = affine3(src, imagePoints.map((p) => p.y));
    if (!ax || !ay) return null;
    const x0 = ax[2];
    const y0 = ay[2];
    const x1 = ax[0] * widthM + ax[2];
    const y1 = ay[0] * widthM + ay[2];
    const width = Math.hypot(x1 - x0, y1 - y0);
    return Number.isFinite(width) && width > 1 ? width : null;
  }
  return null;
}

/**
 * Apparent pixel width from a studio camera. Uses the stored position, target and fov —
 * not a guessed heading. `imageWidth` is the frame width in pixels.
 */
export function widthPxFromStudioCamera(
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
  },
  widthM: number,
  imageWidth: number
): number | null {
  const dx = camera.position[0] - camera.target[0];
  const dy = camera.position[1] - camera.target[1];
  const dz = camera.position[2] - camera.target[2];
  const dist = Math.hypot(dx, dy, dz);
  const fovDeg = camera.fov ?? 45;
  if (dist < 0.05 || imageWidth < 2 || widthM <= 0) return null;
  const visible = 2 * dist * Math.tan(((fovDeg * Math.PI) / 180) / 2);
  if (!Number.isFinite(visible) || visible <= 0) return null;
  const px = (widthM / visible) * imageWidth;
  return Number.isFinite(px) && px > 1 ? px : null;
}
