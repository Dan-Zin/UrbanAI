import { DEFAULT_MAF_CATALOG, MAF_SIZES } from "@/lib/catalog";

export default function ObjectPlacer({
  catalogId,
  onCatalog,
  placedWithGeometry,
  scale,
  onScale,
  groundCount,
  picking,
  onToggleGround,
}: {
  catalogId: string;
  onCatalog: (id: string) => void;
  placedWithGeometry: boolean;
  scale: number;
  onScale: (value: number) => void;
  groundCount: number;
  picking: boolean;
  onToggleGround: () => void;
}) {
  const size = MAF_SIZES[catalogId] ?? { w: 1, d: 1, h: 1 };
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Объект из каталога МАФ
      </div>
      <div className="grid grid-cols-2 gap-1">
        {DEFAULT_MAF_CATALOG.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCatalog(item.id)}
            className={`rounded-md border px-2 py-1.5 text-left text-xs ${
              item.id === catalogId
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                : "border-white/10 text-muted-foreground hover:bg-white/[0.04]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Габарит {size.w.toFixed(2)} × {size.d.toFixed(2)} × {size.h.toFixed(2)} м
      </p>
      <button
        type="button"
        onClick={onToggleGround}
        className={`w-full rounded-md border px-2 py-1.5 text-xs ${
          picking
            ? "border-amber-300/50 bg-amber-500/15 text-amber-100"
            : "border-white/10 text-foreground hover:bg-white/[0.04]"
        }`}
      >
        Указать землю {groundCount > 0 ? `(${groundCount}/4)` : ""}
      </button>
      <p className="text-[11px] text-muted-foreground">
        3–4 клика по покрытию: ближний левый, ближний правый, дальний правый, дальний левый.
        Четыре точки — гомография, три — аффинная оценка. Это не обмер.
      </p>
      {!placedWithGeometry && (
        <label className="block text-[11px] text-muted-foreground">
          Масштаб вручную
          <input
            type="range"
            min={0.4}
            max={2.4}
            step={0.05}
            value={scale}
            onChange={(e) => onScale(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      )}
      {!placedWithGeometry && (
        <div className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
          без привязки к плоскости
        </div>
      )}
    </div>
  );
}
