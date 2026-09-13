"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Building2, Boxes, Map as MapIcon, PanelRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import SentimentPanel from "@/components/panels/SentimentPanel";
import VisualizePanel from "@/components/panels/VisualizePanel";
import CostEstimator from "@/components/panels/CostEstimator";
import CompliancePanel from "@/components/panels/CompliancePanel";
import ObjectToolbar from "@/components/ObjectToolbar";
import { Badge } from "@/components/ui/badge";

// Mapbox GL and Three.js touch `window` — load client-side only.
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <PaneLoader label="Loading map…" />,
});
const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => <PaneLoader label="Booting 3D engine…" />,
});

function PaneLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="animate-pulse text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function Home() {
  const selected = useStore((s) => s.selected);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  // Analytics side panels are hidden by default while terrain generation
  // is being tested; the header button brings them back.
  const [showPanels, setShowPanels] = useState(false);

  return (
    <main className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="glass-strong z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <Building2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">
              Urban <span className="text-emerald-400 text-glow">AI</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Collaborative City Planning · Taganrog
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scenario switcher (ArcGIS-Urban-style plan alternatives) */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
            <span className="px-1.5 text-[10px] text-muted-foreground">
              Scenario
            </span>
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
            variant={showPanels ? "outline" : "ghost"}
            size="sm"
            onClick={() => setShowPanels((v) => !v)}
            title={showPanels ? "Hide AI panels" : "Show AI panels"}
          >
            <PanelRight className="h-4 w-4" />
            AI Panels
          </Button>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <MapIcon className="h-3 w-3" />
            2D Map
          </Badge>
          <motion.div
            animate={selected ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Badge className="hidden sm:inline-flex">
              <Boxes className="h-3 w-3" />
              {selected ? "Sandbox Active" : "Sandbox Idle"}
            </Badge>
          </motion.div>
        </div>
      </header>

      {/* Split screen */}
      <div className="flex min-h-0 flex-1">
        {/* Left: 2D map (40%) */}
        <section className="relative w-2/5 border-r border-white/10">
          <MapComponent />
        </section>

        {/* Right: 3D viewport (60%) */}
        <section className="relative w-3/5">
          <Scene3D />
          <ObjectToolbar />

          {/* Right-side AI panel stack */}
          {showPanels && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-72 flex-col gap-3 overflow-y-auto scrollbar-thin">
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="pointer-events-auto"
            >
              <SentimentPanel />
            </motion.div>
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="pointer-events-auto"
            >
              <CostEstimator />
            </motion.div>
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.19 }}
              className="pointer-events-auto"
            >
              <CompliancePanel />
            </motion.div>
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.26 }}
              className="pointer-events-auto"
            >
              <VisualizePanel />
            </motion.div>
          </div>
          )}
        </section>
      </div>
    </main>
  );
}
