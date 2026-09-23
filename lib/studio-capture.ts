import * as THREE from "three";

export interface StudioCameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface StudioShot {
  imageDataUrl: string;
  camera: StudioCameraPose;
}

type Bridge = {
  shot: () => StudioShot | null;
};

let bridge: Bridge | null = null;

export function registerStudioCapture(next: Bridge | null) {
  bridge = next;
}

export function takeStudioShot(): StudioShot | null {
  return bridge?.shot() ?? null;
}

/**
 * Ray from the reconstructed studio camera through normalized frame uv (0..1, y down).
 * Ground is y = 0, the same plane the sandbox objects sit on.
 * Returns null when the ray misses that plane — caller must not invent a hit.
 *
 * Check: camera (0, 10, 10) looking at origin, uv (0.5, 0.5) → hit (0, 0).
 */
export function projectStudioGround(
  pose: StudioCameraPose,
  uv: { u: number; v: number },
  aspect: number
): { x: number; z: number } | null {
  if (!Number.isFinite(aspect) || aspect <= 0) return null;
  const camera = new THREE.PerspectiveCamera(pose.fov || 45, aspect, 0.1, 800);
  camera.up.set(0, 1, 0);
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  const target = new THREE.Vector3(pose.target[0], pose.target[1], pose.target[2]);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  const ndc = new THREE.Vector2(uv.u * 2 - 1, 1 - uv.v * 2);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  if (!Number.isFinite(hit.x) || !Number.isFinite(hit.z)) return null;
  return { x: hit.x, z: hit.z };
}
