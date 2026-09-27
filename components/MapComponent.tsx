"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EyeOff, Map as MapIcon, MapPin, Satellite } from "lucide-react";
import { motion } from "framer-motion";
import { useStore, TAGANROG_CENTER, type MapStyleId } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { seededRandom } from "@/lib/utils";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const CARTO_DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';
const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SAT_TILES = "/api/sat-tile?z={z}&x={x}&y={y}";
const SAT_ATTRIBUTION =
  "Спутник: Esri / Sentinel-2 / Google";

const MAPBOX_STYLES: Record<MapStyleId, string> = {
  schematic: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

/* ------------------------------------------------------------------ */
/* Real Mapbox GL map (used when a token is configured)                */
/* ------------------------------------------------------------------ */

function MapboxMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const selectPoint = useStore((s) => s.selectPoint);
  const mapStyle = useStore((s) => s.mapStyle);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAPBOX_STYLES[mapStyle],
        center: TAGANROG_CENTER,
        zoom: 14,
        pitch: 30,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");

      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;

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
        selectPoint(lng, lat);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // style is swapped in a separate effect so the map instance survives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAPBOX_STYLES[mapStyle]);
    map.once("style.load", () => {
      if (selected && markerRef.current) {
        markerRef.current.addTo(map);
      }
    });
  }, [mapStyle, selected]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/* ------------------------------------------------------------------ */
/* Leaflet map — free raster basemap, no API key required.             */
/* ------------------------------------------------------------------ */

function LeafletMap({ onFail }: { onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const tilesRef = useRef<import("leaflet").TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [schematicSource, setSchematicSource] = useState<"carto" | "osm">("carto");
  const selectPoint = useStore((s) => s.selectPoint);
  const mapStyle = useStore((s) => s.mapStyle);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [TAGANROG_CENTER[1], TAGANROG_CENTER[0]],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      setMapReady(true);

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
        selectPoint(lng, lat);
      });

      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
      tilesRef.current = null;
      markerRef.current = null;
    };
  }, [selectPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (tilesRef.current) {
        map.removeLayer(tilesRef.current);
        tilesRef.current = null;
      }
      const tiles =
        mapStyle === "satellite"
          ? L.tileLayer(SAT_TILES, {
              maxZoom: 18,
              maxNativeZoom: 18,
              attribution: SAT_ATTRIBUTION,
            })
          : schematicSource === "osm"
            ? L.tileLayer(OSM_TILES, {
                maxZoom: 19,
                attribution: OSM_ATTRIBUTION,
              })
            : L.tileLayer(CARTO_DARK_TILES, {
                subdomains: "abcd",
                maxZoom: 20,
                attribution: CARTO_ATTRIBUTION,
              });
      tiles.addTo(map);
      tilesRef.current = tiles;

      if (mapStyle === "schematic") {
        let loadedOnce = false;
        let tileErrors = 0;
        tiles.on("load", () => {
          loadedOnce = true;
        });
        tiles.on("tileerror", () => {
          if (loadedOnce || cancelled) return;
          tileErrors += 1;
          if (tileErrors < 4) return;
          if (schematicSource === "carto") setSchematicSource("osm");
          else onFailRef.current();
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapStyle, mapReady, schematicSource]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}

/* ------------------------------------------------------------------ */
/* Mock map — last-resort fallback                                     */
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

    ctx.fillStyle = "#0a0f0d";
    ctx.fillRect(0, 0, w, h);

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
    ctx.globalAlpha = 1;
    for (let i = 0; i < 120; i++) {
      const x = (rand() - 0.5) * w * 1.2;
      const y = (rand() - 0.5) * h * 1.2;
      ctx.fillStyle = `rgba(30,41,38,${0.4 + rand() * 0.5})`;
      ctx.fillRect(x, y, 14 + rand() * 26, 10 + rand() * 20);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(167,243,208,0.55)";
    ctx.font = "11px monospace";
    ctx.fillText("ул. Петровская", w * 0.42, h * 0.32);
    ctx.fillText("Театр Чехова", w * 0.6, h * 0.48);
    ctx.fillText("Пушкинская наб.", w * 0.12, h * 0.62);
    ctx.fillText("ТАГАНРОГСКИЙ ЗАЛИВ", w * 0.08, h * 0.85);
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

    const lng = TAGANROG_CENTER[0] + (x / rect.width - 0.5) * 0.06;
    const lat = TAGANROG_CENTER[1] - (y / rect.height - 0.5) * 0.04;
    selectPoint(lng, lat);
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
          Офлайн-карта — тайлы недоступны
        </Badge>
      </div>
    </div>
  );
}

function MapChrome() {
  const selected = useStore((s) => s.selected);
  const mapStyle = useStore((s) => s.mapStyle);
  const setMapStyle = useStore((s) => s.setMapStyle);
  const toggleMapHidden = useStore((s) => s.toggleMapHidden);

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-16 z-[500]">
        <div className="glass-strong flex items-center gap-2 rounded-lg px-3 py-2">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <div className="text-xs">
            <div className="font-semibold">Таганрог</div>
            <div className="text-muted-foreground">
              {selected
                ? `${selected.lat.toFixed(5)}°N, ${selected.lng.toFixed(5)}°E`
                : "Кликните, чтобы открыть площадку"}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-[500] flex gap-1">
        <button
          type="button"
          onClick={() => setMapStyle("schematic")}
          className={`glass-strong flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
            mapStyle === "schematic"
              ? "text-emerald-300 ring-1 ring-emerald-400/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" />
          Схема
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("satellite")}
          className={`glass-strong flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
            mapStyle === "satellite"
              ? "text-emerald-300 ring-1 ring-emerald-400/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Satellite className="h-3.5 w-3.5" />
          Спутник
        </button>
        <button
          type="button"
          onClick={toggleMapHidden}
          className="glass-strong flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          title="Скрыть карту"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Скрыть
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function MapComponent() {
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
      <MapChrome />
    </div>
  );
}
