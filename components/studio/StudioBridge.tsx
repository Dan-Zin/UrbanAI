"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useHasHydrated, usePlatform } from "@/lib/platform-store";
import { Button } from "@/components/ui/button";
import { DEFAULT_MAF_CATALOG } from "@/lib/catalog";
import { takeStudioShot } from "@/lib/studio-capture";
import {
  allowsNaturalView,
  contourAround,
  emptyMask,
  isLngLatAnchor,
  lngLatToLocal,
  type ViewObject,
} from "@/lib/views";
import { viewId } from "@/services/views";
import { fitDataUrl } from "@/services/inpaint";

function catalogFor(object: ViewObject) {
  const id =
    object.catalogId ??
    (object.type === "bin"
      ? "maf-bin"
      : object.type === "lamp"
        ? "maf-lamp"
        : object.type === "paving"
          ? "maf-paving"
          : object.type === "greenery"
            ? "maf-tree"
            : object.type === "parking_pocket"
              ? "maf-pocket"
              : "maf-bench");
  return DEFAULT_MAF_CATALOG.find((item) => item.id === id);
}

export default function StudioBridge() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHasHydrated();
  const selectPoint = useStore((s) => s.selectPoint);
  const selected = useStore((s) => s.selected);
  const objects = useStore((s) => s.objects);
  const totalCost = useStore((s) => s.totalCost);
  const addSketchObject = useStore((s) => s.addSketchObject);
  const clearSketches = useStore((s) => s.clearSketches);
  const attachVisualization = usePlatform((s) => s.attachVisualization);
  const createInitiative = usePlatform((s) => s.createInitiative);
  const saveView = usePlatform((s) => s.saveView);
  const initiatives = usePlatform((s) => s.initiatives);
  const views = usePlatform((s) => s.views);
  const [saved, setSaved] = useState<string | null>(null);
  const [shooting, setShooting] = useState(false);

  const initiativeId = params.get("initiative");
  const viewParam = params.get("view");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const initiative = initiatives.find((item) => item.id === initiativeId);
  const proposal = initiative ? allowsNaturalView(initiative) : false;

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      selectPoint(lng, lat);
    }
  }, [lat, lng, selectPoint]);

  useEffect(() => {
    if (!hydrated || !viewParam || !selected) return;
    const view = views.find((item) => item.id === viewParam);
    if (!view) return;
    for (const object of view.objects) {
      if (!isLngLatAnchor(object.groundAnchor)) continue;
      const item = catalogFor(object);
      if (!item?.mesh) continue;
      const local = lngLatToLocal(
        selected.lng,
        selected.lat,
        object.groundAnchor.lng,
        object.groundAnchor.lat
      );
      addSketchObject({
        kind: "catalog",
        label: `Эскиз · ${item.label}`,
        price: 0,
        position: [local.x, 0, local.z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        catalogId: item.id,
        mesh: item.mesh,
        sketch: true,
      });
    }
    return () => clearSketches();
  }, [hydrated, viewParam, selected, views, addSketchObject, clearSketches]);

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

  const shoot = async () => {
    if (!selected || shooting) {
      if (!selected) setSaved("Сначала выберите точку на карте");
      return;
    }
    setShooting(true);
    setSaved("Снимаю кадр…");
    try {
      const shot = takeStudioShot();
      if (!shot) {
        setSaved("Кадр не снят: сцена ещё не готова");
        return;
      }
      const imageDataUrl = await fitDataUrl(shot.imageDataUrl);
      const dx = shot.camera.target[0] - shot.camera.position[0];
      const dy = shot.camera.target[1] - shot.camera.position[1];
      const dz = shot.camera.target[2] - shot.camera.position[2];
      const target =
        initiative && proposal
          ? initiative
          : createInitiative({
              title: "Благоустройство по кадру вида",
              description:
                "Предлагаем благоустройство этой площадки. Кадр вида снят в 3D-студии.",
              lng: selected.lng,
              lat: selected.lat,
              intent: "proposal",
            });
      const id = viewId("view");
      saveView({
        id,
        initiativeId: target.id,
        contourHint: contourAround(selected.lng, selected.lat),
        createdAt: new Date().toISOString(),
        source: "studio",
        imageDataUrl,
        camera: {
          lat: selected.lat,
          lng: selected.lng,
          heading: (Math.atan2(dx, -dz) * 180) / Math.PI,
          pitch: (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI,
          fov: shot.camera.fov,
          studioCamera: {
            position: shot.camera.position,
            target: shot.camera.target,
          },
        },
        visibility: "street_ok",
        mask: emptyMask(),
        templateId: "replace_paving",
        mode: "inpaint",
        status: "natura",
        objects: [],
        conflicts: [],
      });
      router.push(
        `/views/new?initiative=${target.id}&lng=${selected.lng}&lat=${selected.lat}&view=${id}`
      );
    } catch {
      setSaved("Не удалось снять кадр");
    } finally {
      setShooting(false);
    }
  };

  if (!selected && !initiativeId) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-50 max-w-sm rounded-xl border border-emerald-400/20 bg-black/70 p-3 backdrop-blur-xl">
      <p className="text-xs text-muted-foreground">
        {initiativeId
          ? "Расставьте объекты на площадке и прикрепите эскиз к заявке."
          : "Клик по карте открывает 40×40 м двора. Объекты можно прикрепить к новой инициативе."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={attach} disabled={!selected}>
          {initiativeId ? "Прикрепить к заявке" : "Создать заявку из сцены"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected || shooting}
          title="Сохранить кадр и камеру и открыть натурный вид"
          onClick={() => void shoot()}
        >
          {shooting ? "Снимаю…" : "Снять кадр вида"}
        </Button>
        {saved && <span className="text-[11px] text-emerald-300">{saved}</span>}
      </div>
    </div>
  );
}
