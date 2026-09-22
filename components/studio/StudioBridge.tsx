"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { usePlatform } from "@/lib/platform-store";
import { Button } from "@/components/ui/button";

export default function StudioBridge() {
  const params = useSearchParams();
  const router = useRouter();
  const selectPoint = useStore((s) => s.selectPoint);
  const selected = useStore((s) => s.selected);
  const objects = useStore((s) => s.objects);
  const totalCost = useStore((s) => s.totalCost);
  const attachVisualization = usePlatform((s) => s.attachVisualization);
  const createInitiative = usePlatform((s) => s.createInitiative);
  const [saved, setSaved] = useState<string | null>(null);

  const initiativeId = params.get("initiative");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      selectPoint(lng, lat);
    }
  }, [lat, lng, selectPoint]);

  const attach = () => {
    if (!selected) return;
    const viz = {
      objectCount: objects.length,
      cost: totalCost(),
      note: objects.map((o) => o.label).join(", ") || "Пустая площадка",
      createdAt: new Date().toISOString(),
      lng: selected.lng,
      lat: selected.lat,
    };
    if (initiativeId) {
      attachVisualization(initiativeId, viz);
      setSaved("Эскиз прикреплён к заявке");
      setTimeout(() => router.push(`/initiatives/${initiativeId}`), 700);
      return;
    }
    const item = createInitiative({
      title: "Инициатива из 3D-студии",
      description: `Предложение по благоустройству: ${viz.note}`,
      lng: selected.lng,
      lat: selected.lat,
      visualization: viz,
    });
    setSaved("Создана заявка с 3D-эскизом");
    setTimeout(() => router.push(`/initiatives/${item.id}`), 700);
  };

  if (!selected && !initiativeId) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-40 max-w-sm rounded-xl border border-emerald-400/20 bg-black/70 p-3 backdrop-blur-xl">
      <p className="text-xs text-muted-foreground">
        {initiativeId
          ? "Расставьте объекты на площадке и прикрепите эскиз к заявке."
          : "Клик по карте открывает 40×40 м двора. Объекты можно прикрепить к новой инициативе."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={attach} disabled={!selected}>
          {initiativeId ? "Прикрепить к заявке" : "Создать заявку из сцены"}
        </Button>
        {saved && <span className="text-[11px] text-emerald-300">{saved}</span>}
      </div>
    </div>
  );
}
