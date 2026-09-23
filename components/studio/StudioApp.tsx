"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Boxes,
  Eye,
  EyeOff,
  Map as MapIcon,
  PanelRight,
  Pin,
  ArrowLeft,
} from "lucide-react";
import { PANEL_LABELS, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FloatingPanel, usePanelVisible } from "@/components/ui/FloatingPanel";
import SentimentPanel from "@/components/panels/SentimentPanel";
import VisualizePanel from "@/components/panels/VisualizePanel";
import CostEstimator from "@/components/panels/CostEstimator";
import CompliancePanel from "@/components/panels/CompliancePanel";
import ObjectCatalog from "@/components/ObjectCatalog";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <PaneLoader label="Загрузка карты…" />,
});
const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => <PaneLoader label="Запуск 3D…" />,
});

function PaneLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="animate-pulse text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function FloatingHeader() {
  const selected = useStore((s) => s.selected);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const mapHidden = useStore((s) => s.mapHidden);
  const toggleMapHidden = useStore((s) => s.toggleMapHidden);
  const uiHidden = useStore((s) => s.uiHidden);
  const toggleUiHidden = useStore((s) => s.toggleUiHidden);
  const panelState = useStore((s) => s.panelState);
  const setPanelHidden = useStore((s) => s.setPanelHidden);
  const aiHidden = panelState.ai?.hidden ?? true;

  return (
    <FloatingPanel
      id="header"
      title="3D-студия"
      compact
      className="absolute left-3 right-3 top-3 z-30"
      bodyClassName="flex items-center justify-between gap-3 px-3 py-2 pr-16"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground"
          title="На платформу"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40">
          <Building2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide">3D-студия</h1>
          <p className="text-[10px] text-muted-foreground">Благоустройство · Таганрог</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
          <span className="px-1.5 text-[10px] text-muted-foreground">Сценарий</span>
          {(["A", "B"] as const).map((sc) => (
            <button
              key={sc}
              onClick={() => setScenario(sc)}
              className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-colors ${
                scenario === sc
                  ? "bg-emerald-500/25 text-emerald-300"
                  : "text-muted-foreground hover:bg-white/[0.08]"
              }`}
            >
              {sc}
            </button>
          ))}
        </div>
        <Button
          variant={mapHidden ? "outline" : "ghost"}
          size="sm"
          onClick={toggleMapHidden}
          title={mapHidden ? "Показать карту" : "Скрыть карту"}
        >
          {mapHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Карта
        </Button>
        <Button
          variant={aiHidden ? "ghost" : "outline"}
          size="sm"
          onClick={() => setPanelHidden("ai", !aiHidden)}
          title={aiHidden ? "Показать AI-панели" : "Скрыть AI-панели"}
        >
          <PanelRight className="h-4 w-4" />
          AI
        </Button>
        <Button
          variant={uiHidden ? "outline" : "ghost"}
          size="sm"
          onClick={toggleUiHidden}
          title={uiHidden ? "Показать интерфейс" : "Скрыть незакреплённые панели"}
        >
          {uiHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {uiHidden ? "Показать UI" : "Скрыть UI"}
        </Button>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          <MapIcon className="h-3 w-3" />
          {mapHidden ? "Только 3D" : "Карта + 3D"}
        </Badge>
        <motion.div
          animate={selected ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Badge className="hidden sm:inline-flex">
            <Boxes className="h-3 w-3" />
            {selected ? "Площадка" : "Ожидание"}
          </Badge>
        </motion.div>
      </div>
    </FloatingPanel>
  );
}

function HiddenPanelsDock() {
  const panelState = useStore((s) => s.panelState);
  const setPanelHidden = useStore((s) => s.setPanelHidden);
  const uiHidden = useStore((s) => s.uiHidden);
  const setUiHidden = useStore((s) => s.setUiHidden);
  const headerVisible = usePanelVisible("header");

  const hiddenIds = Object.entries(PANEL_LABELS)
    .filter(([id]) => panelState[id]?.hidden)
    .map(([id, label]) => ({ id, label }));

  if (headerVisible && hiddenIds.length === 0 && !uiHidden) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex max-w-[min(42rem,calc(100%-20rem))] -translate-x-1/2 flex-wrap items-center justify-center gap-1">
      {uiHidden && (
        <button
          type="button"
          onClick={() => setUiHidden(false)}
          className="glass-strong flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-300"
        >
          <Eye className="h-3.5 w-3.5" />
          Показать интерфейс
        </button>
      )}
      {hiddenIds.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setPanelHidden(id, false)}
          className="glass-strong flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Pin className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function StudioApp() {
  const mapHidden = useStore((s) => s.mapHidden);
  const catalogVisible = usePanelVisible("catalog");

  return (
    <main className="relative h-screen overflow-hidden">
      <FloatingHeader />

      <div className="flex h-full min-h-0">
        {!mapHidden && (
          <section className="relative w-[36%] min-w-[260px] border-r border-white/10">
            <MapComponent />
          </section>
        )}

        <section className="relative min-w-0 flex-1">
          <Scene3D />
          <ObjectCatalog />

          <FloatingPanel
            id="ai"
            title="AI-панели"
            className={`absolute top-16 z-10 flex max-h-[calc(100%-5.5rem)] w-72 flex-col ${
              catalogVisible ? "right-[19.5rem]" : "right-3"
            }`}
            bodyClassName="flex flex-col gap-3 overflow-y-auto p-2 scrollbar-thin"
          >
            <SentimentPanel />
            <CostEstimator />
            <CompliancePanel />
            <VisualizePanel />
          </FloatingPanel>

          <HiddenPanelsDock />
        </section>
      </div>
    </main>
  );
}
