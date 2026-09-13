"use client";

import { useEffect } from "react";
import { Move, RotateCw, Scaling } from "lucide-react";
import { useStore, type TransformMode } from "@/lib/store";

const MODES: { id: TransformMode; label: string; hint: string; icon: typeof Move }[] = [
  { id: "translate", label: "Двигать", hint: "W", icon: Move },
  { id: "rotate", label: "Вращать", hint: "E", icon: RotateCw },
  { id: "scale", label: "Размер", hint: "R", icon: Scaling },
];

export default function TransformToolbar() {
  const activeObjectId = useStore((s) => s.activeObjectId);
  const mode = useStore((s) => s.transformMode);
  const setTransformMode = useStore((s) => s.setTransformMode);

  useEffect(() => {
    if (!activeObjectId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyW") setTransformMode("translate");
      if (e.code === "KeyE") setTransformMode("rotate");
      if (e.code === "KeyR") setTransformMode("scale");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeObjectId, setTransformMode]);

  if (!activeObjectId) return null;

  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-xl">
      {MODES.map(({ id, label, hint, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTransformMode(id)}
          title={`${label} (${hint})`}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
            mode === id
              ? "bg-emerald-500/25 text-emerald-200"
              : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          <span className="text-[9px] opacity-60">{hint}</span>
        </button>
      ))}
    </div>
  );
}
