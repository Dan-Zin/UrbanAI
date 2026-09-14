"use client";

import React, { Suspense, useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  TransformControls,
  Grid,
  Environment,
  ContactShadows,
  Text,
  Float,
  Stars,
  Edges,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStore, type Building, type PlacedObject } from "@/lib/store";
import { sunAt } from "@/lib/sun";
import { SANDBOX_SIZE } from "@/lib/constants";
import SurroundingsView from "@/components/scene/Surroundings";
import CatalogMesh from "@/components/scene/CatalogMesh";
import BuildingCard from "@/components/panels/BuildingCard";
import BlockCard from "@/components/panels/BlockCard";
import TimeSlider from "@/components/panels/TimeSlider";
import MetricsPanel from "@/components/panels/MetricsPanel";
import ZoningLegend from "@/components/panels/ZoningLegend";
import TransformToolbar from "@/components/TransformToolbar";

/** Keeps optional remote-asset components (HDR env map, SDF font) from
 *  blanking the whole canvas if their fetch fails, e.g. offline demos. */
class SafeAsset extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}

/* ------------------------------------------------------------------ */
/* Existing buildings (generated from the clicked coordinate)          */
/* ------------------------------------------------------------------ */

function BuildingBlock({ building }: { building: Building }) {
  return (
    <group position={building.position} rotation={[0, building.rotation, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={building.size} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      {/* window strips */}
      <mesh scale={[1.002, 0.9, 1.002]}>
        <boxGeometry args={building.size} />
        <meshStandardMaterial
          color="#10b981"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Placeable object meshes                                             */
/* ------------------------------------------------------------------ */

function TreeMesh() {
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1, 8]} />
        <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <coneGeometry args={[0.65, 1.6, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
    </group>
  );
}

function BenchMesh() {
  return (
    <group>
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[1.4, 0.07, 0.45]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.55, -0.2]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[1.4, 0.5, 0.06]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.7} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} castShadow position={[x, 0.13, 0]}>
          <boxGeometry args={[0.08, 0.26, 0.4]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function LampMesh() {
  return (
    <group>
      <mesh castShadow position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 2.8, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive="#fbbf24"
          emissiveIntensity={2}
        />
      </mesh>
      <pointLight position={[0, 2.85, 0]} intensity={1.2} distance={6} color="#fbbf24" />
    </group>
  );
}

function FountainMesh() {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.1, 1.25, 0.4, 24]} />
        <meshStandardMaterial color="#64748b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.06, 24]} />
        <meshStandardMaterial
          color="#38bdf8"
          transparent
          opacity={0.75}
          roughness={0.05}
          metalness={0.2}
        />
      </mesh>
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 0.8, 12]} />
        <meshStandardMaterial color="#64748b" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* Parametric development block (ArcGIS-Urban-style proposed volume) */

let floorStripeTex: THREE.Texture | null = null;
function getFloorStripeTexture() {
  if (floorStripeTex) return floorStripeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e8eef5";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#9db1c4";
  ctx.fillRect(0, 60, 64, 4); // floor slab line
  floorStripeTex = new THREE.CanvasTexture(c);
  floorStripeTex.wrapS = floorStripeTex.wrapT = THREE.RepeatWrapping;
  floorStripeTex.colorSpace = THREE.SRGBColorSpace;
  return floorStripeTex;
}

const BLOCK_USE_TINTS: Record<string, string> = {
  residential: "#cfe2f5",
  commercial: "#f5deb8",
  mixed: "#d6e8cf",
};

function BlockMesh({ object }: { object: PlacedObject }) {
  const floors = object.floors ?? 1;
  const height = floors * 3.2;
  const map = useMemo(() => {
    const t = getFloorStripeTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(1, floors);
    return t;
  }, [floors]);

  return (
    <mesh castShadow position={[0, height / 2, 0]}>
      <boxGeometry args={[6, height, 8]} />
      <meshStandardMaterial
        color={BLOCK_USE_TINTS[object.use ?? "residential"]}
        map={map}
        transparent
        opacity={0.92}
        roughness={0.55}
        metalness={0.05}
      />
      <Edges color="#6ea8cf" />
    </mesh>
  );
}

function AIObjectMesh() {
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#10b981"
          emissive="#065f46"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
    </Float>
  );
}

const OBJECT_MESHES: Record<
  Exclude<PlacedObject["kind"], "block" | "catalog">,
  () => JSX.Element
> = {
  tree: TreeMesh,
  bench: BenchMesh,
  lamp: LampMesh,
  fountain: FountainMesh,
  ai: AIObjectMesh,
};

/* ------------------------------------------------------------------ */
/* Placed object with selection + transform gizmo                      */
/* ------------------------------------------------------------------ */

function PlacedObjectNode({ object }: { object: PlacedObject }) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const activeObjectId = useStore((s) => s.activeObjectId);
  const setActiveObject = useStore((s) => s.setActiveObject);
  const updateObject = useStore((s) => s.updateObject);
  const setTransforming = useStore((s) => s.setTransforming);
  const transforming = useStore((s) => s.transforming);
  const transformMode = useStore((s) => s.transformMode);

  const isActive = activeObjectId === object.id;
  const Mesh =
    object.kind === "block" || object.kind === "catalog" || object.mesh
      ? null
      : OBJECT_MESHES[object.kind];
  const scale = object.scale ?? [1, 1, 1];
  const ringR =
    (object.kind === "block"
      ? 5.4
      : object.mesh
        ? Math.max(object.mesh.size[0], object.mesh.size[2]) * 0.65 + 0.2
        : 0.75) * Math.max(scale[0], scale[2]);

  const live = isActive && transforming;
  const pose = live
    ? {}
    : {
        position: object.position,
        rotation: object.rotation ?? [0, 0, 0],
        scale,
      };

  return (
    <>
      <group
        ref={setGroup}
        {...pose}
        onClick={(e) => {
          e.stopPropagation();
          setActiveObject(object.id);
        }}
      >
        {object.kind === "block" ? (
          <BlockMesh object={object} />
        ) : object.mesh ? (
          <CatalogMesh mesh={object.mesh} />
        ) : Mesh ? (
          <Mesh />
        ) : (
          <AIObjectMesh />
        )}
        {isActive && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[ringR, ringR + 0.14, 32]} />
            <meshBasicMaterial color="#34d399" transparent opacity={0.85} />
          </mesh>
        )}
      </group>

      {isActive && group && (
        <TransformControls
          object={group}
          mode={transformMode}
          space={transformMode === "translate" ? "world" : "local"}
          showY={transformMode !== "translate"}
          size={0.85}
          onMouseDown={() => setTransforming(true)}
          onMouseUp={() => {
            setTransforming(false);
            const half = SANDBOX_SIZE / 2 - 0.3;
            const x = THREE.MathUtils.clamp(group.position.x, -half, half);
            const z = THREE.MathUtils.clamp(group.position.z, -half, half);
            group.position.set(x, 0, z);
            const sx = THREE.MathUtils.clamp(group.scale.x, 0.15, 6);
            const sy = THREE.MathUtils.clamp(group.scale.y, 0.15, 6);
            const sz = THREE.MathUtils.clamp(group.scale.z, 0.15, 6);
            group.scale.set(sx, sy, sz);
            updateObject(object.id, {
              position: [x, 0, z],
              rotation: [group.rotation.x, group.rotation.y, group.rotation.z],
              scale: [sx, sy, sz],
            });
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Scene content                                                       */
/* ------------------------------------------------------------------ */

function SandboxContent() {
  const buildings = useStore((s) => s.buildings);
  const surroundings = useStore((s) => s.surroundings);
  const objects = useStore((s) => s.objects);
  const selected = useStore((s) => s.selected);
  const transforming = useStore((s) => s.transforming);
  const setActiveObject = useStore((s) => s.setActiveObject);
  const setActiveBuilding = useStore((s) => s.setActiveBuilding);
  const timeOfDay = useStore((s) => s.timeOfDay);
  const showSatellite = useStore((s) => s.showSatellite);
  const satelliteStatus = useStore((s) => s.satelliteStatus);
  const satDraped =
    showSatellite &&
    (satelliteStatus === "ready" || satelliteStatus === "enhancing");
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  // ArcGIS-Urban-style sun analysis: light follows real solar position
  const sun = useMemo(() => sunAt(timeOfDay), [timeOfDay]);
  const d = sun.daylight;
  const sunColor = useMemo(
    () =>
      "#" +
      new THREE.Color("#ff8c48")
        .lerp(
          new THREE.Color("#fff3dd"),
          THREE.MathUtils.clamp(sun.altitude * 2.2, 0, 1)
        )
        .getHexString(),
    [sun.altitude]
  );

  // Gentle camera reset whenever a new site is selected
  useEffect(() => {
    if (selected) {
      camera.position.set(SANDBOX_SIZE * 0.85, SANDBOX_SIZE * 0.65, SANDBOX_SIZE * 0.85);
      controlsRef.current?.target.set(0, 0, 0);
    }
  }, [selected, camera]);

  return (
    <>
      <SafeAsset>
        <Environment preset="city" environmentIntensity={0.12 + 0.3 * d} />
      </SafeAsset>
      {d < 0.35 && (
        <Stars radius={220} depth={60} count={2500} factor={3.5} fade speed={0.4} />
      )}
      <hemisphereLight args={["#3a5470", "#0a0f0d", 0.15 + 0.55 * d]} />
      <ambientLight intensity={0.07 + 0.22 * d} color="#8ba0bd" />
      {/* the sun */}
      <directionalLight
        position={sun.position}
        intensity={0.04 + 1.9 * d}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-180}
        shadow-camera-right={180}
        shadow-camera-top={180}
        shadow-camera-bottom={-180}
        shadow-camera-far={420}
        shadow-bias={-0.0004}
      />
      {/* moon / sky fill at night */}
      <directionalLight
        position={[-30, 45, 40]}
        intensity={0.08 + 0.28 * (1 - d)}
        color="#5b7ea8"
      />

      {/* Planning sandbox area */}
      <Grid
        args={[SANDBOX_SIZE, SANDBOX_SIZE]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#134e4a"
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor="#10b981"
        fadeDistance={90}
        fadeStrength={1.5}
        position={[0, satDraped ? 0.12 : 0.02, 0]}
        renderOrder={3}
      />

      {/* Sandbox fill — hidden when the orthophoto is down, it z-fights the sat */}
      {!satDraped && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[SANDBOX_SIZE, SANDBOX_SIZE]} />
          <meshStandardMaterial color="#052e26" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Ground click-catcher. Parked well below the sat plane to avoid z-fight. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, satDraped ? -2 : -0.02, 0]}
        receiveShadow={!satDraped}
        onClick={() => {
          setActiveObject(null);
          setActiveBuilding(null);
        }}
      >
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color="#0a1210" roughness={1} />
      </mesh>

      {/* Real OSM surroundings when loaded; procedural blocks otherwise */}
      {surroundings ? (
        <SurroundingsView data={surroundings} />
      ) : (
        buildings.map((b) => <BuildingBlock key={b.id} building={b} />)
      )}

      {objects.map((o) => (
        <PlacedObjectNode key={o.id} object={o} />
      ))}

      {selected && (
        <SafeAsset>
        <Text
          position={[0, 0.05, SANDBOX_SIZE / 2 + 1]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="#34d399"
          anchorX="center"
        >
          {`ПЛОЩАДКА · ${SANDBOX_SIZE}×${SANDBOX_SIZE} м · ${selected.lat.toFixed(4)}N ${selected.lng.toFixed(4)}E`}
        </Text>
        </SafeAsset>
      )}

      {!satDraped && (
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.55}
          scale={SANDBOX_SIZE * 2.2}
          blur={2.2}
          far={18}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enabled={!transforming}
        makeDefault
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={280}
        enableDamping
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function DataSourceBadge() {
  const osmStatus = useStore((s) => s.osmStatus);
  const surroundings = useStore((s) => s.surroundings);
  if (osmStatus === "idle") return null;

  const label =
    osmStatus === "loading"
      ? "Загружаю здания и улицы (OSM)…"
      : osmStatus === "ready" && surroundings
        ? `OpenStreetMap · ${surroundings.buildings.length} зданий · ${surroundings.roads.length} дорог`
        : "OSM недоступен — процедурные блоки";

  return (
    <div className="pointer-events-none absolute left-3 top-16 z-10">
      <div className="glass-strong flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]">
        <span
          className={`h-2 w-2 rounded-full ${
            osmStatus === "loading"
              ? "animate-pulse-glow bg-sky-400"
              : osmStatus === "ready"
                ? "bg-emerald-400"
                : "bg-amber-400"
          }`}
        />
        <span className="text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export default function Scene3D() {
  const selected = useStore((s) => s.selected);
  const timeOfDay = useStore((s) => s.timeOfDay);
  const sky = useMemo(() => {
    const dl = sunAt(timeOfDay).daylight;
    return (
      "#" +
      new THREE.Color("#050807")
        .lerp(new THREE.Color("#1c3247"), dl)
        .getHexString()
    );
  }, [timeOfDay]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{
          position: [SANDBOX_SIZE * 0.85, SANDBOX_SIZE * 0.65, SANDBOX_SIZE * 0.85],
          fov: 45,
        }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[sky]} />
        <Suspense fallback={null}>
          <SandboxContent />
        </Suspense>
        <EffectComposer>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.82}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <DataSourceBadge />
      <ZoningLegend />
      <BuildingCard />
      <BlockCard />
      {selected && <TimeSlider />}
      {selected && <MetricsPanel />}
      {selected && <TransformToolbar />}

      {!selected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="glass-strong rounded-xl px-6 py-4 text-center">
            <div className="text-sm font-medium text-emerald-300">
              Точка не выбрана
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Кликните на карте, чтобы открыть 3D-площадку
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
