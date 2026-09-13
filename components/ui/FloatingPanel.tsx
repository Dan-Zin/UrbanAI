"use client";

import { Pin, PinOff, EyeOff } from "lucide-react";
import { DEFAULT_PANELS, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function usePanelVisible(id: string) {
  const uiHidden = useStore((s) => s.uiHidden);
  const state = useStore((s) => s.panelState[id]);
  const fallback = DEFAULT_PANELS[id] ?? { pinned: false, hidden: false };
  const pinned = state?.pinned ?? fallback.pinned;
  const hidden = state?.hidden ?? fallback.hidden;
  return !hidden && (pinned || !uiHidden);
}

export function FloatingPanel({
  id,
  title,
  children,
  className,
  bodyClassName,
  headerExtra,
  compact = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerExtra?: React.ReactNode;
  compact?: boolean;
}) {
  const visible = usePanelVisible(id);
  const state = useStore((s) => s.panelState[id]);
  const fallback = DEFAULT_PANELS[id] ?? { pinned: false, hidden: false };
  const pinned = state?.pinned ?? fallback.pinned;
  const togglePin = useStore((s) => s.togglePanelPin);
  const toggleHidden = useStore((s) => s.togglePanelHidden);

  if (!visible) return null;

  const chrome = (
    <div className="flex shrink-0 items-center gap-0.5">
      {headerExtra}
      <button
        type="button"
        onClick={() => togglePin(id)}
        title={pinned ? "Открепить" : "Закрепить"}
        className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        {pinned ? (
          <Pin className="h-3 w-3 text-emerald-400" />
        ) : (
          <PinOff className="h-3 w-3" />
        )}
      </button>
      <button
        type="button"
        onClick={() => toggleHidden(id)}
        title="Скрыть"
        className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        <EyeOff className="h-3 w-3" />
      </button>
    </div>
  );

  if (compact) {
    return (
      <div className={cn("glass-strong pointer-events-auto overflow-hidden", className)}>
        <div className="absolute right-2 top-2 z-10">{chrome}</div>
        <div className={bodyClassName}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("glass-strong pointer-events-auto overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-1.5">
        <span className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground">
          {title}
        </span>
        {chrome}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
