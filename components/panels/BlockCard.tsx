"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Boxes, Minus, Plus } from "lucide-react";
import { useStore, type BlockUse } from "@/lib/store";
import { blockGFA } from "@/lib/metrics";
import { Button } from "@/components/ui/button";

const USES: { id: BlockUse; label: string }[] = [
  { id: "residential", label: "Resid." },
  { id: "commercial", label: "Comm." },
  { id: "mixed", label: "Mixed" },
];

export default function BlockCard() {
  const activeObjectId = useStore((s) => s.activeObjectId);
  const object = useStore(
    (s) => s.objects.find((o) => o.id === s.activeObjectId) ?? null
  );
  const updateObject = useStore((s) => s.updateObject);

  const block = object?.kind === "block" ? object : null;

  return (
    <AnimatePresence>
      {block && (
        <motion.div
          key={activeObjectId}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="glass-strong absolute bottom-4 left-4 z-10 w-64 rounded-xl p-3"
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <Boxes className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold">Development block</span>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Floors</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6"
                disabled={(block.floors ?? 1) <= 1}
                onClick={() =>
                  updateObject(block.id, { floors: (block.floors ?? 1) - 1 })
                }
                aria-label="Fewer floors"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center font-semibold tabular-nums">
                {block.floors}
              </span>
              <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6"
                disabled={(block.floors ?? 1) >= 25}
                onClick={() =>
                  updateObject(block.id, { floors: (block.floors ?? 1) + 1 })
                }
                aria-label="More floors"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-3 gap-1">
            {USES.map((u) => (
              <button
                key={u.id}
                onClick={() => updateObject(block.id, { use: u.id })}
                className={`rounded-md py-1 text-[10px] font-medium transition-colors ${
                  block.use === u.id
                    ? "bg-emerald-500/25 text-emerald-300"
                    : "bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1]"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>GFA: {blockGFA(block).toLocaleString()} m²</span>
            <span className="tabular-nums text-emerald-300">
              ${block.price.toLocaleString()}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
