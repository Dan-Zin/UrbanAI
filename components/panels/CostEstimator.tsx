"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Coins, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CostEstimator() {
  const objects = useStore((s) => s.objects);
  const removeObject = useStore((s) => s.removeObject);
  const activeObjectId = useStore((s) => s.activeObjectId);
  const setActiveObject = useStore((s) => s.setActiveObject);
  const total = objects.reduce((sum, o) => sum + o.price, 0);

  return (
    <Card className="glass-emerald">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-emerald-400" />
          Смета
        </CardTitle>
        <motion.span
          key={total}
          initial={{ scale: 1.25, color: "#6ee7b7" }}
          animate={{ scale: 1, color: "#34d399" }}
          className="text-lg font-bold tabular-nums text-glow"
        >
          ${total.toLocaleString()}
        </motion.span>
      </CardHeader>
      <CardContent>
        {objects.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Добавьте объекты с каталога — смета обновится сразу.
          </p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-y-auto scrollbar-thin">
            <AnimatePresence initial={false}>
              {objects.map((o) => (
                <motion.li
                  key={o.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  onClick={() => setActiveObject(o.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                    activeObjectId === o.id
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "hover:bg-white/[0.05]"
                  }`}
                >
                  <span>{o.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      ${o.price.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeObject(o.id);
                      }}
                      aria-label={`Remove ${o.label}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
