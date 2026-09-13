"use client";

import { motion } from "framer-motion";
import { TreePine, Armchair, Lamp, Droplets, Wand2, Building } from "lucide-react";
import { useState } from "react";
import { useStore, CATALOG } from "@/lib/store";
import { generate3DAsset } from "@/services/ai";
import { Button } from "@/components/ui/button";

const TOOLS = [
  { kind: "tree", icon: TreePine, label: "Tree" },
  { kind: "bench", icon: Armchair, label: "Bench" },
  { kind: "lamp", icon: Lamp, label: "Lamp" },
  { kind: "fountain", icon: Droplets, label: "Fountain" },
  { kind: "block", icon: Building, label: "Block" },
] as const;

export default function ObjectToolbar() {
  const selected = useStore((s) => s.selected);
  const addObject = useStore((s) => s.addObject);
  const addAIObject = useStore((s) => s.addAIObject);
  const [generating, setGenerating] = useState(false);

  const handleAIGenerate = async () => {
    setGenerating(true);
    try {
      const asset = await generate3DAsset("modern kiosk pavilion");
      addAIObject(asset.label, asset.price);
    } finally {
      setGenerating(false);
    }
  };

  if (!selected) return null;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="glass-strong absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl p-1.5"
    >
      {TOOLS.map(({ kind, icon: Icon, label }) => (
        <Button
          key={kind}
          variant="ghost"
          size="sm"
          className="flex-col gap-0.5 px-3 py-1 h-auto"
          onClick={() => addObject(kind)}
          title={
            kind === "block"
              ? "Parametric 6x8 m development volume"
              : `Add ${label} — $${CATALOG[kind].price}`
          }
        >
          <Icon className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px]">{label}</span>
          <span className="text-[9px] text-muted-foreground">
            {kind === "block" ? "6×8 m" : `$${CATALOG[kind].price}`}
          </span>
        </Button>
      ))}
      <div className="mx-1 h-8 w-px bg-white/10" />
      <Button
        variant="outline"
        size="sm"
        className="flex-col gap-0.5 px-3 py-1 h-auto"
        onClick={handleAIGenerate}
        disabled={generating}
        title="Generate a 3D asset with Tripo AI"
      >
        <Wand2 className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
        <span className="text-[10px]">{generating ? "…" : "AI Object"}</span>
        <span className="text-[9px] text-muted-foreground">Tripo</span>
      </Button>
    </motion.div>
  );
}
