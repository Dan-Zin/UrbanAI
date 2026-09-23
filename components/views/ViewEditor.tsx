"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useHasHydrated, usePlatform } from "@/lib/platform-store";
import { MAF_SIZES } from "@/lib/catalog";
import { objectWidthPx, widthPxFromStudioCamera } from "@/lib/homography";
import { projectStudioGround } from "@/lib/studio-capture";
import {
  SKETCH_DISCLAIMER,
  YARD_BLIND_WARNING,
  allowsNaturalView,
  catalogConflicts,
  contourAround,
  emptyMask,
  localMetersToLngLat,
  mafSize,
  templateById,
  templateConflicts,
  viewObjectTypeForCatalog,
  type SiteView,
  type ViewObject,
} from "@/lib/views";
import { viewId } from "@/services/views";
import {
  compositeObjects,
  fitDataUrl,
  maskCentroid,
  runInpaint,
  type InpaintResult,
} from "@/services/inpaint";
import MaskCanvas, { type MaskTool } from "./MaskCanvas";
import TemplatePicker from "./TemplatePicker";
import ObjectPlacer from "./ObjectPlacer";
import ViewStatusBadge from "./ViewStatusBadge";

interface Sprite {
  type: ViewObject["type"];
  u: number;
  v: number;
  widthPx: number;
}

async function readFile(file: File): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return fitDataUrl(url);
}

function panoramaStub(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, 0, 960, 540);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(0, 320, 960, 220);
  ctx.fillStyle = "#9ca3af";
  ctx.fillRect(70, 400, 820, 18);
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "22px sans-serif";
  ctx.fillText("Заглушка уличной панорамы. Внутренность двора не видна.", 36, 120);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function ViewEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHasHydrated();
  const initiativeId = params.get("initiative") ?? "";
  const viewParam = params.get("view");
  const queryLng = Number(params.get("lng"));
  const queryLat = Number(params.get("lat"));
  const initiatives = usePlatform((s) => s.initiatives);
  const saveView = usePlatform((s) => s.saveView);
  const commentInitiative = usePlatform((s) => s.commentInitiative);
  const initiative = initiatives.find((item) => item.id === initiativeId);
  const proposal = initiative ? allowsNaturalView(initiative) : false;

  const lng = initiative?.lng ?? (Number.isFinite(queryLng) ? queryLng : 38.9265);
  const lat = initiative?.lat ?? (Number.isFinite(queryLat) ? queryLat : 47.2123);

  const [source, setSource] = useState<SiteView["source"]>("upload");
  const [image, setImage] = useState<string | null>(null);
  const [plate, setPlate] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [status, setStatus] = useState<SiteView["status"]>("natura");
  const [visibility, setVisibility] = useState<SiteView["visibility"]>("street_ok");
  const [mask, setMask] = useState<SiteView["mask"]>(emptyMask());
  const [tool, setTool] = useState<MaskTool>("lasso");
  const [templateId, setTemplateId] = useState("replace_paving");
  const [mode, setMode] = useState<SiteView["mode"]>("inpaint");
  const [catalogId, setCatalogId] = useState("maf-bench");
  const [ground, setGround] = useState<{ x: number; y: number }[]>([]);
  const [pickingGround, setPickingGround] = useState(false);
  const [anchor, setAnchor] = useState({ u: 0.5, v: 0.72 });
  const [manualScale, setManualScale] = useState(1);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [cameraPose, setCameraPose] = useState<SiteView["camera"]>({ lat, lng });
  const [maskObject, setMaskObject] = useState<ViewObject | null>(null);
  const [placed, setPlaced] = useState<ViewObject[]>([]);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(viewParam);
  const fileRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  const views = usePlatform((s) => s.views);
  useEffect(() => {
    if (!hydrated || !viewParam || loaded.current) return;
    const existing = views.find((view) => view.id === viewParam);
    if (!existing) return;
    loaded.current = true;
    setImage(existing.imageDataUrl);
    setPlate(existing.resultImageDataUrl ?? existing.imageDataUrl);
    setResult(existing.resultImageDataUrl ?? null);
    setShowResult(Boolean(existing.resultImageDataUrl));
    setStatus(existing.status);
    setVisibility(existing.visibility);
    setMask(existing.mask);
    setTemplateId(existing.templateId || "replace_paving");
    setMode(existing.mode);
    setSource(existing.source);
    setCameraPose(existing.camera);
    setMaskObject(existing.objects.find((item) => item.source === "mask") ?? null);
    setPlaced(existing.objects.filter((item) => item.source !== "mask"));
  }, [hydrated, viewParam, views]);

  const conflicts = useMemo(() => {
    if (!initiative) return [];
    const fromTemplate = templateConflicts(templateId, initiative.districtId);
    if (mode !== "place_object") return fromTemplate;
    const itemLabel =
      catalogId === "maf-bench"
        ? "Скамейка"
        : catalogId === "maf-bin"
          ? "Урна"
          : catalogId === "maf-lamp"
            ? "Фонарь"
            : catalogId === "maf-paving"
              ? "Бетонная плитка"
              : catalogId === "maf-tree"
                ? "Дерево"
                : "Парковочный карман";
    return [...fromTemplate, ...catalogConflicts(itemLabel, initiative.districtId)];
  }, [catalogId, initiative, mode, templateId]);

  const geometry = useMemo(() => {
    const size = MAF_SIZES[catalogId] ?? mafSize(catalogId);
    if (!frame) return { widthPx: 72, placed: false };
    if (ground.length >= 3) {
      const px = objectWidthPx(
        ground.map((p) => ({ x: p.x * frame.w, y: p.y * frame.h })),
        size.w
      );
      if (px) return { widthPx: px, placed: true };
    }
    if (cameraPose.studioCamera) {
      const px = widthPxFromStudioCamera(
        { ...cameraPose.studioCamera, fov: cameraPose.fov },
        size.w,
        frame.w
      );
      if (px) return { widthPx: px, placed: true };
    }
    return { widthPx: (size.w / 20) * frame.w * manualScale, placed: false };
  }, [cameraPose, catalogId, frame, ground, manualScale]);

  const publish = async (
    base: string,
    nextSprites: Sprite[],
    painted: Pick<InpaintResult, "mock" | "caption">
  ) => {
    const hypothesis = visibility === "yard_blind";
    const caption = painted.mock ? "демо-эскиз" : painted.caption;
    const imageDataUrl = await compositeObjects({
      baseDataUrl: base,
      sprites: nextSprites,
      caption,
      hypothesis,
    });
    setPlate(base);
    setResult(imageDataUrl);
    setShowResult(true);
    setStatus(hypothesis ? "gipoteza" : "eskiz");
    setNote(
      painted.mock
        ? "Ключа Fal нет — нарисован демо-эскиз, картиночная модель не вызывалась."
        : "Эскиз получен. Это не проект и не обмер."
    );
    return imageDataUrl;
  };

  const applyFrame = (
    dataUrl: string,
    nextSource: SiteView["source"],
    nextVisibility: SiteView["visibility"],
    pose?: SiteView["camera"]
  ) => {
    setImage(dataUrl);
    setPlate(dataUrl);
    setResult(null);
    setShowResult(false);
    setSource(nextSource);
    setVisibility(nextVisibility);
    setStatus("natura");
    setMask(emptyMask());
    setGround([]);
    setMaskObject(null);
    setPlaced([]);
    setSprites([]);
    setCameraPose(pose ?? { lat, lng });
    setNote(null);
  };

  const generate = async () => {
    if (!image || conflicts.length > 0) return;
    if (mask.points.length < 2) {
      setNote("Выделите фрагмент маской — свободный промпт не принимается.");
      return;
    }
    const template = templateById(templateId);
    if (!template) return;
    setBusy(true);
    try {
      const painted = await runInpaint({
        imageDataUrl: image,
        mask,
        prompt: template.prompt,
        caption: template.label,
        hypothesis: visibility === "yard_blind",
      });
      const hypothesis = visibility === "yard_blind";
      const foot = maskCentroid(mask);
      const nextMask: ViewObject | null = template.objectType
        ? {
            id: viewId("vo"),
            type: template.objectType,
            catalogId: template.catalogId ?? undefined,
            source: hypothesis ? "gipoteza" : "mask",
            status: "eskiz",
            groundAnchor: foot,
            sizeMeters: mafSize(template.catalogId),
            placedWithGeometry: ground.length >= 3 || Boolean(cameraPose.studioCamera),
          }
        : null;
      setMaskObject(nextMask);
      await publish(painted.imageDataUrl, sprites, painted);
    } finally {
      setBusy(false);
    }
  };

  const place = async () => {
    if (!image || conflicts.length > 0) return;
    setBusy(true);
    try {
      const hypothesis = visibility === "yard_blind";
      const size = mafSize(catalogId);
      let groundAnchor: ViewObject["groundAnchor"] = { u: anchor.u, v: anchor.v };
      let placedWithGeometry = geometry.placed;
      if (cameraPose.studioCamera && frame) {
        const hit = projectStudioGround(
          {
            position: cameraPose.studioCamera.position,
            target: cameraPose.studioCamera.target,
            fov: cameraPose.fov ?? 45,
          },
          anchor,
          frame.w / frame.h
        );
        if (hit) {
          groundAnchor = localMetersToLngLat(cameraPose.lng, cameraPose.lat, hit.x, hit.z);
          placedWithGeometry = true;
        }
      } else if (ground.length < 3) {
        placedWithGeometry = false;
      }
      const object: ViewObject = {
        id: viewId("vo"),
        type: viewObjectTypeForCatalog(catalogId),
        catalogId,
        source: hypothesis ? "gipoteza" : "catalog",
        status: "eskiz",
        groundAnchor,
        sizeMeters: size,
        placedWithGeometry,
      };
      const sprite: Sprite = {
        type: object.type,
        u: anchor.u,
        v: anchor.v,
        widthPx: geometry.widthPx,
      };
      const nextSprites = [...sprites, sprite];
      const nextPlaced = [...placed, object];
      setSprites(nextSprites);
      setPlaced(nextPlaced);
      const base = plate ?? image;
      await publish(base, nextSprites, { mock: false, caption: "эскиз" });
      setNote(
        placedWithGeometry
          ? "Объект поставлен по плоскости земли или камере студии. Это эскиз, не обмер."
          : "Объект поставлен без привязки к плоскости. Масштаб ручной."
      );
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!initiative || !image || !consent) return;
    const id = savedId ?? viewId("view");
    const view: SiteView = {
      id,
      initiativeId: initiative.id,
      contourHint: contourAround(initiative.lng, initiative.lat),
      createdAt: new Date().toISOString(),
      source,
      imageDataUrl: image,
      camera: { ...cameraPose, lat: initiative.lat, lng: initiative.lng },
      visibility,
      mask,
      templateId,
      mode,
      status,
      resultImageDataUrl: result ?? undefined,
      objects: [...(maskObject ? [maskObject] : []), ...placed],
      conflicts,
    };
    saveView(view);
    setSavedId(id);
    setNote("Кадр сохранён в карточке заявки. Статус заявки не менялся.");
    router.replace(
      `/views/new?initiative=${initiative.id}&lng=${initiative.lng}&lat=${initiative.lat}&view=${id}`
    );
  };

  if (!hydrated) {
    return <p className="p-8 text-sm text-muted-foreground">Загрузка заявки…</p>;
  }
  if (!initiative) {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Натурный вид открывается из заявки.{" "}
        <Link href="/map" className="text-emerald-300">
          К карте
        </Link>
      </p>
    );
  }
  if (!proposal) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-4 py-10">
        <h1 className="text-xl font-semibold">Натурный вид</h1>
        <p className="text-sm text-muted-foreground">
          Это оперативный дефект. Для него остаются фото и классификация. Перерисовка двора и
          постановка МАФ отключены — эскиз не заменяет ремонт ямы или поломки.
        </p>
        <Link href={`/initiatives/${initiative.id}`}>
          <Button variant="outline">К заявке</Button>
        </Link>
      </div>
    );
  }

  const shown = showResult && result ? result : image;
  const previewType = viewObjectTypeForCatalog(catalogId);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Натурный вид</h1>
          <ViewStatusBadge status={status} />
          <span className="text-xs text-muted-foreground">{initiative.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{SKETCH_DISCLAIMER}</p>
        {visibility === "yard_blind" && (
          <p className="rounded-md border border-amber-300/40 bg-amber-500/10 p-2 text-xs text-amber-100">
            {YARD_BLIND_WARNING}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            Загрузить фото
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void readFile(file).then((url) => applyFrame(url, "upload", "street_ok"));
            }}
          />
          <Link
            href={`/studio?lng=${initiative.lng}&lat=${initiative.lat}&initiative=${initiative.id}`}
          >
            <Button size="sm" variant="outline">
              Кадр из студии
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyFrame(panoramaStub(), "panorama", "yard_blind")}
          >
            Панорама
          </Button>
          {(["lasso", "brush", "rect", "eraser"] as const).map((id) => (
            <Button
              key={id}
              size="sm"
              variant={tool === id && mode === "inpaint" ? "default" : "ghost"}
              onClick={() => {
                setTool(id);
                setMode("inpaint");
                setShowResult(false);
              }}
            >
              {id === "lasso" ? "Лассо" : id === "brush" ? "Кисть" : id === "rect" ? "Прямоугольник" : "Ластик маски"}
            </Button>
          ))}
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={mask.excludeWindows}
              onChange={(e) => setMask({ ...mask, excludeWindows: e.target.checked })}
            />
            Исключить окна
          </label>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <MaskCanvas
            imageUrl={shown}
            mask={showResult ? { ...mask, points: [] } : mask}
            tool={tool}
            status={status}
            groundPoints={ground}
            pickingGround={pickingGround}
            placeMode={mode === "place_object" && !showResult}
            anchor={anchor}
            preview={
              mode === "place_object" && !showResult
                ? { type: previewType, widthPx: geometry.widthPx }
                : null
            }
            onMask={(next) => {
              setMask(next);
              setShowResult(false);
            }}
            onGroundPoint={(point) => setGround((prev) => (prev.length >= 4 ? prev : [...prev, point]))}
            onAnchor={setAnchor}
            onSize={(size) =>
              setFrame((prev) => (prev && prev.w === size.w && prev.h === size.h ? prev : size))
            }
          />
        </div>
        {result && (
          <button
            type="button"
            className="text-xs text-emerald-300"
            onClick={() => setShowResult((v) => !v)}
          >
            {showResult ? "Показать натуру и маску" : "Показать эскиз"}
          </button>
        )}
      </section>

      <aside className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <TemplatePicker
          value={templateId}
          onChange={setTemplateId}
          conflicts={conflicts}
          districtId={initiative.districtId}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "inpaint" ? "default" : "outline"}
            onClick={() => setMode("inpaint")}
          >
            Эскиз по маске
          </Button>
          <Button
            size="sm"
            variant={mode === "place_object" ? "default" : "outline"}
            onClick={() => {
              setMode("place_object");
              setShowResult(false);
            }}
          >
            Поставить объект
          </Button>
        </div>
        {mode === "place_object" && (
          <ObjectPlacer
            catalogId={catalogId}
            onCatalog={setCatalogId}
            placedWithGeometry={geometry.placed}
            scale={manualScale}
            onScale={setManualScale}
            groundCount={ground.length}
            picking={pickingGround}
            onToggleGround={() => setPickingGround((v) => !v)}
          />
        )}
        <div className="flex flex-col gap-2">
          <Button disabled={busy || conflicts.length > 0 || !image} onClick={() => void generate()}>
            Сгенерировать эскиз
          </Button>
          <Button
            variant="outline"
            disabled={busy || conflicts.length > 0 || !image}
            onClick={() => void place()}
          >
            Поставить объект
          </Button>
          <Button variant="ghost" onClick={() => setMask(emptyMask())}>
            Сбросить маску
          </Button>
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          в кадре нет крупно окон квартир / номеров / лиц
        </label>
        <Button className="w-full" disabled={!consent || !image || busy} onClick={save}>
          Сохранить в заявку
        </Button>
        {savedId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => commentInitiative(initiative.id, "Житель подтвердил этот эскиз")}
          >
            Житель подтвердил этот эскиз
          </Button>
        )}
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        <Link href={`/initiatives/${initiative.id}`} className="block text-xs text-emerald-300">
          К карточке заявки
        </Link>
      </aside>
    </div>
  );
}
