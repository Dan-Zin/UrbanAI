"use client";

import type { GeneratedMesh, MeshPart, MeshPrimitive } from "@/lib/catalog";

function PartMaterial({
  color,
  roughness = 0.62,
  metalness = 0.08,
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
}: {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
}) {
  const transparent = opacity < 0.98;
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={emissiveIntensity}
      transparent={transparent}
      opacity={opacity}
      envMapIntensity={0.85}
    />
  );
}

function Primitive({ part }: { part: Pick<MeshPart, "primitive" | "color" | "size" | "roughness" | "metalness" | "emissive" | "emissiveIntensity" | "opacity"> }) {
  const [w, h, d] = part.size;
  const material = (
    <PartMaterial
      color={part.color}
      roughness={part.roughness}
      metalness={part.metalness}
      emissive={part.emissive}
      emissiveIntensity={part.emissiveIntensity}
      opacity={part.opacity}
    />
  );
  const primitive: MeshPrimitive = part.primitive;

  if (primitive === "cylinder") {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[w / 2, Math.min(w, d) / 2, h, 24]} />
        {material}
      </mesh>
    );
  }
  if (primitive === "sphere") {
    return (
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[Math.max(w, h, d) / 2, 24, 18]} />
        {material}
      </mesh>
    );
  }
  if (primitive === "cone") {
    return (
      <mesh castShadow receiveShadow>
        <coneGeometry args={[w / 2, h, 20]} />
        {material}
      </mesh>
    );
  }
  if (primitive === "capsule") {
    const radius = Math.max(0.02, Math.min(w, d) / 2);
    const length = Math.max(0.02, h - radius * 2);
    return (
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[radius, length, 6, 16]} />
        {material}
      </mesh>
    );
  }
  if (primitive === "torus") {
    const radius = Math.max(0.04, w / 2);
    const tube = Math.max(0.012, Math.min(h, w) / 6);
    return (
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, tube, 12, 28]} />
        {material}
      </mesh>
    );
  }
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      {material}
    </mesh>
  );
}

function Part({ part }: { part: MeshPart }) {
  return (
    <group position={part.position} rotation={part.rotation ?? [0, 0, 0]}>
      <Primitive part={part} />
    </group>
  );
}

export default function CatalogMesh({ mesh }: { mesh: GeneratedMesh }) {
  if (mesh.parts?.length) {
    return (
      <group>
        {mesh.parts.map((part, i) => (
          <Part key={i} part={part} />
        ))}
      </group>
    );
  }

  const primitive: MeshPrimitive =
    mesh.primitive === "group" ? "box" : mesh.primitive;
  return (
    <group position={[0, mesh.size[1] / 2, 0]}>
      <Primitive
        part={{
          primitive,
          color: mesh.color,
          size: mesh.size,
          roughness: 0.58,
          metalness: 0.1,
        }}
      />
    </group>
  );
}
