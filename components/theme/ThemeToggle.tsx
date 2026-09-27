"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, subscribeTheme, themePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Светлая", icon: Sun },
  { id: "dark", label: "Тёмная", icon: Moon },
  { id: "system", label: "Системная", icon: Monitor },
];

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeTheme, themePreference, () => "dark");
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const preference = useThemePreference();
  return (
    <div
      role="group"
      aria-label="Тема интерфейса"
      className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => applyTheme(option.id)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
              active
                ? "bg-emerald-500/25 text-emerald-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {!compact && option.label}
          </button>
        );
      })}
    </div>
  );
}
