export type ThemePreference = "light" | "dark" | "system";

const KEY = "urban-theme";

const listeners = new Set<() => void>();

export function themePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

export function resolvedTheme(): "light" | "dark" {
  const preference = themePreference();
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

export function applyTheme(preference: ThemePreference) {
  localStorage.setItem(KEY, preference);
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (themePreference() === "system") applyTheme("system");
  };
  media.addEventListener("change", onMedia);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
  };
}

/** Runs before paint so the chosen theme does not flash the dark default. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("urban-theme")||"dark";var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.dataset.theme=dark?"dark":"light";root.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
