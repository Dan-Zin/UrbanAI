import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic pseudo-random generator seeded from lng/lat, so the same
 *  map click always produces the same "existing buildings" in the sandbox. */
export function seededRandom(seed: number) {
  let s = Math.abs(Math.floor(seed * 1e6)) % 2147483647;
  if (s === 0) s = 12345;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
