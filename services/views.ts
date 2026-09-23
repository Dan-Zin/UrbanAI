import type { SiteView } from "@/lib/views";

/** Same key as the platform Zustand persist. Views live on that blob, not a second store. */
export const DEMO_STORAGE_KEY = "tochka-rosta-demo-v1";

export function viewId(prefix = "view"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function upsertView(views: SiteView[], view: SiteView): SiteView[] {
  const index = views.findIndex((item) => item.id === view.id);
  if (index === -1) return [view, ...views];
  const next = views.slice();
  next[index] = view;
  return next;
}

export function viewsForInitiative(views: SiteView[], initiativeId: string): SiteView[] {
  return views.filter((view) => view.initiativeId === initiativeId);
}

interface PersistBlob {
  state?: { views?: unknown };
}

export function readStoredViews(): SiteView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return [];
    const blob = JSON.parse(raw) as PersistBlob;
    return Array.isArray(blob.state?.views) ? (blob.state.views as SiteView[]) : [];
  } catch {
    return [];
  }
}
