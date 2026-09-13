"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, Layers, LoaderCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { checkCompliance } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CompliancePanel() {
  const selected = useStore((s) => s.selected);
  const objects = useStore((s) => s.objects);
  const compliance = useStore((s) => s.compliance);
  const setCompliance = useStore((s) => s.setCompliance);

  // Pillar 4: re-run the GIS safety check whenever objects change
  useEffect(() => {
    if (!selected || objects.length === 0) return;
    let stale = false;
    setCompliance({
      status: "checking",
      message: "Проверяю слои GIS…",
      layers: [],
    });
    checkCompliance(objects, selected.lng, selected.lat).then((r) => {
      if (!stale) setCompliance(r);
    });
    return () => {
      stale = true;
    };
  }, [objects, selected, setCompliance]);

  const statusLight =
    compliance.status === "clear"
      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
      : compliance.status === "warning"
        ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
        : compliance.status === "checking"
          ? "bg-sky-400 animate-pulse-glow"
          : "bg-slate-600";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {compliance.status === "warning" ? (
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          )}
          Проверка ограничений
        </CardTitle>
        <span className={`h-3 w-3 rounded-full transition-colors ${statusLight}`} />
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p
          className={`text-xs ${
            compliance.status === "warning"
              ? "text-amber-300"
              : compliance.status === "clear"
                ? "text-emerald-300"
                : "text-muted-foreground"
          }`}
        >
          {compliance.status === "checking" && (
            <LoaderCircle className="mr-1 inline h-3 w-3 animate-spin" />
          )}
          {compliance.message}
        </p>

        <AnimatePresence>
          {compliance.layers.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 overflow-hidden"
            >
              {compliance.layers.map((l) => (
                <li
                  key={l.name}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {l.name}
                  </span>
                  <span className={l.ok ? "text-emerald-400" : "text-amber-400"}>
                    {l.ok ? "Свободно" : "Конфликт"}
                  </span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
