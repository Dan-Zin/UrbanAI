"use client";

import { Eye, EyeOff, LoaderCircle, Sparkles, Satellite } from "lucide-react";
import { useStore } from "@/lib/store";
import { ZONE_COLORS } from "@/components/scene/zoneColors";
import { FloatingPanel } from "@/components/ui/FloatingPanel";

const LABELS: Record<string, string> = {
  residential: "Жилая",
  commercial: "Коммерция",
  industrial: "Промышленность",
  retail: "Ритейл",
  education: "Образование",
  green: "Парки",
  water: "Вода",
};

export default function ZoningLegend() {
  const surroundings = useStore((s) => s.surroundings);
  const showZoning = useStore((s) => s.showZoning);
  const toggleZoning = useStore((s) => s.toggleZoning);
  const showSatellite = useStore((s) => s.showSatellite);
  const toggleSatellite = useStore((s) => s.toggleSatellite);
  const enhanceSatellite = useStore((s) => s.enhanceSatellite);
  const toggleEnhanceSatellite = useStore((s) => s.toggleEnhanceSatellite);
  const satelliteStatus = useStore((s) => s.satelliteStatus);

  if (!surroundings) return null;
  const kinds = Array.from(new Set(surroundings.areas.map((a) => a.kind)));

  return (
    <FloatingPanel
      id="zoning"
      title="Слои"
      className="absolute left-3 top-28 z-10"
      bodyClassName="p-2 text-[10px]"
    >
      <button
        onClick={toggleSatellite}
        className="mb-1 flex w-full items-center justify-between gap-3 font-semibold text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Satellite className="h-3 w-3" />
          Спутник 3D
        </span>
        {showSatellite ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
      {surroundings.areas.length > 0 && (
        <button
          onClick={toggleZoning}
          className="mb-1 flex w-full items-center justify-between gap-3 font-semibold text-muted-foreground hover:text-foreground"
        >
          <span>Зонирование</span>
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
        <>
          <button
            onClick={toggleEnhanceSatellite}
            className="mb-1 flex w-full items-center justify-between gap-3 font-semibold text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Нейросеть
            </span>
            {enhanceSatellite ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
          </button>
          <div className="mt-1 border-t border-white/10 pt-1 text-[8px] text-muted-foreground/70">
            {satelliteStatus === "loading" && "Собираю 4K-тайлы (z20/z19)…"}
            {satelliteStatus === "enhancing" && (
              <span className="flex items-center gap-1">
                <LoaderCircle className="h-3 w-3 animate-spin" />
                Масштабирую подложку до 4096…
              </span>
            )}
            {satelliteStatus === "ready" &&
              (enhanceSatellite
                ? "Подложка 4K (4096), без mipmap"
                : "Спутник без 4K-масштаба")}
            {satelliteStatus === "failed" && "Снимок не загрузился"}
            {satelliteStatus === "idle" && "Спутник через локальный прокси"}
          </div>
        </>
      )}
    </FloatingPanel>
  );
}
