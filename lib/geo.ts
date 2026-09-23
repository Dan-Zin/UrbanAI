import type { District } from "./domain";

export function pointInPolygon(
  lng: number,
  lat: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findDistrict(
  lng: number,
  lat: number,
  districts: District[]
): District {
  const hit = districts.find((d) => pointInPolygon(lng, lat, d.polygon));
  if (hit) return hit;
  return districts.reduce((best, d) => {
    const db = (best.center[0] - lng) ** 2 + (best.center[1] - lat) ** 2;
    const dd = (d.center[0] - lng) ** 2 + (d.center[1] - lat) ** 2;
    return dd < db ? d : best;
  });
}

export function haversineM(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const STREETS: { name: string; lng: number; lat: number }[] = [
  { name: "ул. Петровская", lng: 38.9282, lat: 47.2158 },
  { name: "ул. Чехова", lng: 38.9241, lat: 47.2174 },
  { name: "ул. Ленина", lng: 38.9196, lat: 47.2201 },
  { name: "ул. Греческая", lng: 38.9334, lat: 47.2129 },
  { name: "пер. Итальянский", lng: 38.9358, lat: 47.2112 },
  { name: "ул. Фрунзе", lng: 38.9152, lat: 47.2188 },
  { name: "ул. Сызранова", lng: 38.8874, lat: 47.2215 },
  { name: "ул. Москатова", lng: 38.9021, lat: 47.2284 },
  { name: "ул. Дзержинского", lng: 38.9412, lat: 47.2086 },
  { name: "ул. Ломоносова", lng: 38.8769, lat: 47.2398 },
  { name: "ул. Солнечная", lng: 38.9425, lat: 47.2608 },
  { name: "ул. Михайловская", lng: 38.9444, lat: 47.2678 },
  { name: "ул. Щаденко", lng: 38.894, lat: 47.241 },
  { name: "наб. Комсомольская", lng: 38.9386, lat: 47.2054 },
  { name: "ул. Александровская", lng: 38.9308, lat: 47.214 },
  { name: "ул. Розы Люксембург", lng: 38.9215, lat: 47.2136 },
];

export function reverseGeocode(lng: number, lat: number): string {
  const nearest = STREETS.reduce((best, s) =>
    haversineM(lng, lat, s.lng, s.lat) < haversineM(lng, lat, best.lng, best.lat)
      ? s
      : best
  );
  const house = 8 + (Math.abs(Math.floor(lng * 1e5 + lat * 1e5)) % 90);
  return `${nearest.name}, д. ${house}`;
}

export function routeAssignee(districtName: string, categoryLabel: string): string {
  return `${districtName} · ${categoryLabel}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isOverdue(initiative: { status: string; dueAt: string }): boolean {
  if (initiative.status === "done" || initiative.status === "rejected") return false;
  return new Date(initiative.dueAt).getTime() < Date.now();
}
