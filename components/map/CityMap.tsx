"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DISTRICTS } from "@/lib/seed";
import { districtScore } from "@/lib/gamification";
import { districtColor } from "@/lib/format";
import type { Initiative } from "@/lib/domain";
import { TAGANROG_CENTER } from "@/lib/store";

const STATUS_COLOR: Record<string, string> = {
  new: "#38bdf8",
  review: "#a78bfa",
  in_progress: "#f59e0b",
  done: "#34d399",
  rejected: "#f43f5e",
};

type Mode = "browse" | "pick" | "admin";

export default function CityMap({
  initiatives,
  mode = "browse",
  selectedId,
  pick,
  onPick,
}: {
  initiatives: Initiative[];
  mode?: Mode;
  selectedId?: string;
  pick?: { lng: number; lat: number } | null;
  onPick?: (lng: number, lat: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const router = useRouter();
  const [mapReady, setMapReady] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([TAGANROG_CENTER[1], TAGANROG_CENTER[0]], 13);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CARTO',
      }).addTo(map);
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      map.on("click", (e: { latlng: { lng: number; lat: number } }) => {
        if (modeRef.current === "browse") return;
        onPickRef.current?.(e.latlng.lng, e.latlng.lat);
      });
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group || !mapReady) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      group.clearLayers();

      DISTRICTS.forEach((d) => {
        const items = initiatives.filter((i) => i.districtId === d.id);
        const score = districtScore(items);
        const latlngs = d.polygon.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(latlngs, {
          color: districtColor(score.color),
          weight: 1,
          fillColor: districtColor(score.color),
          fillOpacity: mode === "admin" ? 0.28 : 0.12,
        })
          .bindTooltip(
            `${d.name}: ${Math.round(score.resolvedShare * 100)}% решено`,
            { sticky: true }
          )
          .addTo(group);
      });

      initiatives.forEach((item) => {
        const color = STATUS_COLOR[item.status] ?? "#94a3b8";
        const icon = L.divIcon({
          className: "tocity-marker",
          html: `<div style="width:${item.id === selectedId ? 18 : 12}px;height:${
            item.id === selectedId ? 18 : 12
          }px;border-radius:999px;background:${color};box-shadow:0 0 0 3px ${color}55"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([item.lat, item.lng], { icon }).bindTooltip(item.title);
        if (mode === "browse" || mode === "admin") {
          marker.on("click", () => router.push(`/initiatives/${item.id}`));
        }
        marker.addTo(group);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [initiatives, mode, router, selectedId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pick || !mapReady) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      if (!markerRef.current) {
        const icon = L.divIcon({
          className: "tocity-marker",
          html: `<div style="width:16px;height:16px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px #34d39966"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        markerRef.current = L.marker([pick.lat, pick.lng], { icon }).addTo(map);
      } else {
        markerRef.current.setLatLng([pick.lat, pick.lng]);
      }
      map.panTo([pick.lat, pick.lng]);
    })();
    return () => {
      cancelled = true;
    };
  }, [pick, mapReady]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
