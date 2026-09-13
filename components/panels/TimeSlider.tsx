"use client";

import { Sun, Moon } from "lucide-react";
import { useStore } from "@/lib/store";
import { sunAt, formatHour } from "@/lib/sun";
import { FloatingPanel } from "@/components/ui/FloatingPanel";

export default function TimeSlider() {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const night = sunAt(timeOfDay).daylight < 0.15;

  return (
    <FloatingPanel
      id="time"
      title="Время суток"
      className="absolute left-1/2 top-16 z-10 -translate-x-1/2"
    >
      <div className="flex items-center gap-2.5 px-3.5 py-1.5">
        {night ? (
          <Moon className="h-3.5 w-3.5 text-sky-300" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-300" />
        )}
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
          className="h-1 w-36 cursor-pointer appearance-none rounded-full bg-white/15 accent-emerald-400"
          aria-label="Время суток"
        />
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {formatHour(timeOfDay)}
        </span>
      </div>
    </FloatingPanel>
  );
}
