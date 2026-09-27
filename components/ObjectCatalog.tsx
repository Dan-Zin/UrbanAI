"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  CATALOG_CATEGORIES,
  filterCatalog,
  formatDimensions,
  parseGeneratedPayload,
  payloadToCatalogItem,
  mockGenerateObject,
  type CatalogItem,
} from "@/lib/catalog";
import { generateCatalogObject } from "@/services/ai";
import { FloatingPanel } from "@/components/ui/FloatingPanel";
import { Button } from "@/components/ui/button";

async function fileToDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 768;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

export default function ObjectCatalog() {
  const selected = useStore((s) => s.selected);
  const catalog = useStore((s) => s.catalog);
  const addCatalogItem = useStore((s) => s.addCatalogItem);
  const addFromCatalog = useStore((s) => s.addFromCatalog);
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const filtered = filterCatalog(catalog, query);
  const groups = CATALOG_CATEGORIES.map((category) => ({
    ...category,
    items: filtered.filter((item) => item.category === category.id),
  })).filter((group) => group.items.length > 0);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await fileToDataUrl(file));
      setStatus("Фото приложено — добавьте описание или сразу генерируйте");
    } catch {
      setStatus("Не удалось прочитать фото");
    }
  };

  const generate = async () => {
    if (!prompt.trim() && !photo) {
      setStatus("Напишите, что нужно, или приложите фото");
      return;
    }
    setBusy(true);
    setStatus("Нейросеть собирает объект…");
    try {
      const payload = parseGeneratedPayload(
        await generateCatalogObject(prompt, photo),
        prompt
      );
      addCatalogItem(payloadToCatalogItem(payload, prompt, photo));
      setStatus(payload.message);
      setPrompt("");
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      const fallback = mockGenerateObject(prompt, !!photo);
      addCatalogItem(payloadToCatalogItem(fallback, prompt, photo));
      setStatus(fallback.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingPanel
      id="catalog"
      title="Каталог объектов"
      className="absolute right-3 top-16 z-20 flex w-72 flex-col"
      bodyClassName="flex max-h-[calc(100vh-5.5rem)] flex-col"
    >
      <div className="border-b border-white/10 p-2.5">
        <label htmlFor="catalog-search" className="sr-only">
          Поиск по каталогу
        </label>
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: название, артикул, материал, производитель"
          className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-emerald-400/40"
        />
      </div>

      <div className="space-y-2 border-b border-white/10 p-2.5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Опишите объект: детская горка, киоск, вазон…"
          rows={2}
          className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-emerald-400/40"
        />
        <div className="flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {photo ? "Другое фото" : "Фото"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={generate}
          >
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {busy ? "…" : "Сгенерировать"}
          </Button>
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Референс"
            className="h-16 w-full rounded-md object-cover"
          />
        )}
        {status && (
          <p className="text-[11px] leading-relaxed text-emerald-200/80">{status}</p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2 scrollbar-thin">
        {filtered.length === 0 && (
          <div className="space-y-2 px-1 py-6 text-center">
            <p className="text-xs text-muted-foreground">Ничего не найдено</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
              Сбросить фильтр
            </Button>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.id} className="space-y-1.5">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            {group.items.map((item) => (
              <CatalogCard
                key={item.id}
                item={item}
                disabled={!selected}
                onPlace={() => addFromCatalog(item.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </FloatingPanel>
  );
}

function CatalogCard({
  item,
  disabled,
  onPlace,
}: {
  item: CatalogItem;
  disabled: boolean;
  onPlace: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPlace}
      title={disabled ? "Сначала выберите точку на карте" : item.description}
      className="flex w-full items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/10 disabled:opacity-40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumbnail}
        alt=""
        className="h-11 w-11 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{item.label}</span>
          {item.source === "ai" && <Sparkles className="h-3 w-3 shrink-0 text-emerald-400" />}
        </div>
        <div className="truncate text-[10px] text-muted-foreground">
          {item.article} · {item.manufacturer}
        </div>
        <div className="truncate text-[10px] text-muted-foreground">
          {formatDimensions(item.lengthM, item.widthM, item.heightM)} · {item.material}
          {item.colorName ? ` · ${item.colorName}` : ""}
          {item.weightKg != null ? ` · ${item.weightKg} кг` : ""}
        </div>
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {item.builtinKind === "block" ? "6×8 м" : `${item.price.toLocaleString("ru-RU")} ₽`}
      </span>
    </button>
  );
}
