"use client";

import { useMemo } from "react";
import { BarChart3, Users, Briefcase, Landmark, Layers3 } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  computeContextMetrics,
  computeScenarioMetrics,
} from "@/lib/metrics";

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function MetricsPanel() {
  const surroundings = useStore((s) => s.surroundings);
  const scenarios = useStore((s) => s.scenarios);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);

  const context = useMemo(
    () => computeContextMetrics(surroundings),
    [surroundings]
  );
  const mA = useMemo(() => computeScenarioMetrics(scenarios.A), [scenarios.A]);
  const mB = useMemo(() => computeScenarioMetrics(scenarios.B), [scenarios.B]);

  const rows = [
    {
      icon: Layers3,
      label: "GFA, m²",
      a: fmt(mA.proposedGFA),
      b: fmt(mB.proposedGFA),
    },
    { icon: Users, label: "Residents", a: fmt(mA.residents), b: fmt(mB.residents) },
    { icon: Briefcase, label: "Jobs", a: fmt(mA.jobs), b: fmt(mB.jobs) },
    {
      icon: Landmark,
      label: "Invest, $",
      a: fmt(mA.investment),
      b: fmt(mB.investment),
    },
    {
      icon: BarChart3,
      label: "FAR (site)",
      a: mA.far.toFixed(1),
      b: mB.far.toFixed(1),
    },
  ];

  return (
    <div className="glass-strong absolute bottom-4 right-3 z-10 w-60 rounded-xl p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold tracking-wide">Capacity</span>
        <span className="text-[10px] text-muted-foreground">
          ctx: {fmt(context.contextGFA)} m² · {fmt(context.contextResidents)} res
        </span>
      </div>

      <div className="mb-1 grid grid-cols-[1fr_3.4rem_3.4rem] gap-1 text-[10px] text-muted-foreground">
        <span />
        {(["A", "B"] as const).map((sc) => (
          <button
            key={sc}
            onClick={() => setScenario(sc)}
            className={`rounded-md py-0.5 text-center font-semibold transition-colors ${
              scenario === sc
                ? "bg-emerald-500/25 text-emerald-300"
                : "bg-white/[0.05] hover:bg-white/[0.1]"
            }`}
          >
            {sc}
          </button>
        ))}
      </div>

      {rows.map(({ icon: Icon, label, a, b }) => (
        <div
          key={label}
          className="grid grid-cols-[1fr_3.4rem_3.4rem] items-center gap-1 border-t border-white/5 py-1"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="h-3 w-3 text-emerald-400/80" />
            {label}
          </span>
          <span
            className={`text-right tabular-nums ${scenario === "A" ? "text-emerald-200" : ""}`}
          >
            {a}
          </span>
          <span
            className={`text-right tabular-nums ${scenario === "B" ? "text-emerald-200" : ""}`}
          >
            {b}
          </span>
        </div>
      ))}
    </div>
  );
}
