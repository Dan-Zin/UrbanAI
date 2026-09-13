"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Satellite } from "lucide-react";
import { motion } from "framer-motion";
import { useStore, TAGANROG_CENTER } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { seededRandom } from "@/lib/utils";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/* ------------------------------------------------------------------ */
/* Real Mapbox GL map (used when a token is configured)                */
/* ------------------------------------------------------------------ */

function MapboxMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const selectPoint = useStore((s) => s.selectPoint);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: TAGANROG_CENTER,
        zoom: 14,
        pitch: 30,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;

        // Drop / move the pulsing marker
        if (!markerRef.current) {
          const el = document.createElement("div");
          el.className = "urban-marker";
          markerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          markerRef.current.setLngLat([lng, lat]);
        }

        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16), duration: 800 });
        selectPoint(lng, lat); // <-- Sync event: Map -> Store -> 3D Scene
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [selectPoint]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/* ------------------------------------------------------------------ */
/* Leaflet map — free dark CARTO raster basemap, no API key required.  */
/* Default when NEXT_PUBLIC_MAPBOX_TOKEN is not set. Plain <img> tiles */
/* (no WebGL / web workers), so it renders on any network that can     */
/* reach {a,b,c}.basemaps.cartocdn.com.                                */
/* ------------------------------------------------------------------ */

const CARTO_DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

function LeafletMap({ onFail }: { onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const selectPoint = useStore((s) => s.selectPoint);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [TAGANROG_CENTER[1], TAGANROG_CENTER[0]], // Leaflet is [lat, lng]
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;

      const tiles = L.tileLayer(CARTO_DARK_TILES, {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: CARTO_ATTRIBUTION,
      }).addTo(map);

      // Fall back to the offline mock map if the first tiles can't load
      let loadedOnce = false;
      let tileErrors = 0;
      tiles.on("load", () => {
        loadedOnce = true;
      });
      tiles.on("tileerror", () => {
        if (!loadedOnce && ++tileErrors >= 4 && !cancelled) onFail();
      });

      const markerIcon = L.divIcon({
        className: "",
        html: '<div class="urban-marker"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;

        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }

        map.setView([lat, lng], Math.max(map.getZoom(), 16), {
          animate: true,
          duration: 0.8,
        });
        selectPoint(lng, lat); // <-- Sync event: Map -> Store -> 3D Scene
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [selectPoint, onFail]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}

/* ------------------------------------------------------------------ */
/* Mock map — procedural dark street grid of Taganrog, fully clickable */
/* (last-resort fallback when the free basemap can't be reached)       */
/* ------------------------------------------------------------------ */

function MockMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const selectPoint = useStore((s) => s.selectPoint);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    // Base
    ctx.fillStyle = "#0a0f0d";
    ctx.fillRect(0, 0, w, h);

    // Taganrog Bay in the south-west corner
    const sea = ctx.createLinearGradient(0, h, w * 0.5, h * 0.4);
    sea.addColorStop(0, "#06251f");
    sea.addColorStop(1, "#0a0f0d");
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.quadraticCurveTo(w * 0.35, h * 0.75, w * 0.55, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(52,211,153,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Street grid (Taganrog's historic diagonal grid)
    const rand = seededRandom(4.7);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(148,163,184,0.16)";
    for (let i = -20; i <= 20; i++) {
      const major = i % 4 === 0;
      ctx.lineWidth = major ? 2 : 0.75;
      ctx.globalAlpha = major ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(i * 42, -h);
      ctx.lineTo(i * 42, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, i * 42);
      ctx.lineTo(w, i * 42);
      ctx.stroke();
    }
    // City blocks
    ctx.globalAlpha = 1;
    for (let i = 0; i < 120; i++) {
      const x = (rand() - 0.5) * w * 1.2;
      const y = (rand() - 0.5) * h * 1.2;
      ctx.fillStyle = `rgba(30,41,38,${0.4 + rand() * 0.5})`;
      ctx.fillRect(x, y, 14 + rand() * 26, 10 + rand() * 20);
    }
    ctx.restore();

    // Landmark labels
    ctx.fillStyle = "rgba(167,243,208,0.55)";
    ctx.font = "11px monospace";
    ctx.fillText("Petrovskaya st.", w * 0.42, h * 0.32);
    ctx.fillText("Chekhov Theatre", w * 0.6, h * 0.48);
    ctx.fillText("Pushkinskaya emb.", w * 0.12, h * 0.62);
    ctx.fillText("TAGANROG BAY", w * 0.08, h * 0.85);
  }, []);

  useEffect(() => {
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMarker({ x, y });

    // Project pixel position onto a plausible lng/lat window around Taganrog
    const lng = TAGANROG_CENTER[0] + ((x / rect.width) - 0.5) * 0.06;
    const lat = TAGANROG_CENTER[1] - ((y / rect.height) - 0.5) * 0.04;
    selectPoint(lng, lat); // <-- Sync event: Map -> Store -> 3D Scene
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="absolute inset-0 cursor-crosshair"
      />
      {marker && (
        <motion.div
          key={`${marker.x}-${marker.y}`}
          initial={{ scale: 0, y: -14 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="pointer-events-none absolute"
          style={{ left: marker.x - 9, top: marker.y - 9 }}
        >
          <div className="urban-marker" />
        </motion.div>
      )}
      <div className="pointer-events-none absolute bottom-3 right-3">
        <Badge variant="secondary" className="backdrop-blur-md">
          <Satellite className="h-3 w-3" />
          Offline basemap — live tiles unreachable
        </Badge>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function MapComponent() {
  const selected = useStore((s) => s.selected);
  // Basemap priority: Mapbox (if token) -> free Leaflet+CARTO -> offline mock
  const [tilesFailed, setTilesFailed] = useState(false);
  const handleTilesFail = useCallback(() => setTilesFailed(true), []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {MAPBOX_TOKEN ? (
        <MapboxMap />
      ) : tilesFailed ? (
        <MockMap />
      ) : (
        <LeafletMap onFail={handleTilesFail} />
      )}

      {/* Floating header chip */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="glass-strong flex items-center gap-2 rounded-lg px-3 py-2">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <div className="text-xs">
            <div className="font-semibold">Taganrog, Russia</div>
            <div className="text-muted-foreground">
              {selected
                ? `${selected.lat.toFixed(5)}°N, ${selected.lng.toFixed(5)}°E`
                : "Click the map to open a planning sandbox"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
