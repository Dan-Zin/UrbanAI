"use client";

import { Eye, EyeOff, Satellite } from "lucide-react";
import { useStore } from "@/lib/store";
import { ZONE_COLORS } from "@/components/scene/zoneColors";

const LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  retail: "Retail",
  education: "Education",
  green: "Green / parks",
  water: "Water",
};

export default function ZoningLegend() {
  const surroundings = useStore((s) => s.surroundings);
  const showZoning = useStore((s) => s.showZoning);
  const toggleZoning = useStore((s) => s.toggleZoning);
  const showSatellite = useStore((s) => s.showSatellite);
  const toggleSatellite = useStore((s) => s.toggleSatellite);

  if (!surroundings) return null;
  const kinds = Array.from(new Set(surroundings.areas.map((a) => a.kind)));

  return (
    <div className="glass-strong absolute left-3 top-12 z-10 rounded-lg p-2 text-[10px]">
      <button
        onClick={toggleSatellite}
        className="mb-1 flex w-full items-center justify-between gap-3 font-semibold text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Satellite className="h-3 w-3" />
          Satellite
        </span>
        {showSatellite ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
      {surroundings.areas.length > 0 && (
        <button
          onClick={toggleZoning}
          className="mb-1 flex w-full items-center justify-between gap-3 font-semibold text-muted-foreground hover:text-foreground"
        >
          <span>Land use</span>
          {showZoning ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
      )}
      {showZoning &&
        kinds.map((k) => (
          <div key={k} className="flex items-center gap-1.5 py-0.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: ZONE_COLORS[k] }}
            />
            <span className="text-muted-foreground">{LABELS[k] ?? k}</span>
          </div>
        ))}
      {showSatellite && (
        <div className="mt-1 border-t border-white/10 pt-1 text-[8px] text-muted-foreground/70">
          Imagery © Esri, Maxar
        </div>
      )}
    </div>
  );
}
