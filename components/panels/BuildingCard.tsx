"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Camera, LoaderCircle, ScanSearch, Sparkles, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  analyzeStreetScene,
  findFacadePhoto,
  generateFacadeTexture,
  MOCK_MODE,
} from "@/services/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Converts a building's local-meter centroid back to lng/lat. */
function centroidLngLat(
  footprint: [number, number][],
  origin: { lng: number; lat: number }
) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of footprint) {
    cx += x;
    cz += z;
  }
  cx /= footprint.length;
  cz /= footprint.length;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return { lng: origin.lng + cx / mPerDegLng, lat: origin.lat - cz / mPerDegLat };
}

export default function BuildingCard() {
  const selected = useStore((s) => s.selected);
  const surroundings = useStore((s) => s.surroundings);
  const activeBuildingId = useStore((s) => s.activeBuildingId);
  const setActiveBuilding = useStore((s) => s.setActiveBuilding);
  const setBuildingTexture = useStore((s) => s.setBuildingTexture);
  const setBuildingSpec = useStore((s) => s.setBuildingSpec);
  const hasTexture = useStore(
    (s) => s.activeBuildingId != null && !!s.buildingTextures[s.activeBuildingId]
  );
  const spec = useStore(
    (s) => (s.activeBuildingId != null ? s.buildingSpecs[s.activeBuildingId] : undefined)
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const building =
    surroundings?.buildings.find((b) => b.id === activeBuildingId) ?? null;

  // Panorama -> vision analysis -> facade spec + street furniture in 3D
  const handleReconstruct = async () => {
    if (!building || !selected) return;
    setBusy(true);
    setStatus("Looking for a street photo…");
    try {
      const { lng, lat } = centroidLngLat(building.footprint, selected);
      const photo = await findFacadePhoto(lng, lat).catch(() => null);
      setStatus(
        photo
          ? "Photo found — analyzing the scene…"
          : "No photo — reconstructing from building type…"
      );
      const analysis = await analyzeStreetScene({
        photoUrl: photo,
        kind: building.kind === "yes" ? "residential" : building.kind,
        levels: building.levels,
        seed: building.id,
      });
      setBuildingSpec(building.id, analysis);
      setStatus(null);
    } catch {
      setStatus("Analysis failed — try again");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!building || !selected) return;
    setBusy(true);
    setStatus("Looking for a street photo…");
    try {
      const { lng, lat } = centroidLngLat(building.footprint, selected);
      const photo = await findFacadePhoto(lng, lat).catch(() => null);
      setStatus(
        photo
          ? "Photo found — generating texture…"
          : MOCK_MODE.photo
            ? "No Mapillary key — generating without photo…"
            : "No photo nearby — generating from description…"
      );
      const url = await generateFacadeTexture({
        photoUrl: photo,
        kind: building.kind === "yes" ? "residential" : building.kind,
        levels: building.levels,
        seed: building.id,
      });
      setBuildingTexture(building.id, url);
      setStatus(null);
    } catch {
      setStatus("Generation failed — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {building && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          className="glass-strong absolute bottom-3 left-[16.5rem] z-10 w-64 rounded-xl p-3"
        >
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <div className="text-xs">
                <div className="font-semibold">
                  {building.name ?? `Building #${building.id % 10000}`}
                </div>
                <div className="text-muted-foreground">
                  {building.kind === "yes" ? "building" : building.kind} ·{" "}
                  {building.levels} fl. · {building.height.toFixed(0)} m
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveBuilding(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            className="w-full"
            size="sm"
            disabled={busy}
            onClick={handleReconstruct}
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Working…
              </>
            ) : spec ? (
              <>
                <ScanSearch />
                Re-analyze scene
              </>
            ) : (
              <>
                <ScanSearch />
                AI Reconstruct
              </>
            )}
          </Button>
          {spec && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {spec.source === "photo" ? "From street photo" : "From building type"}:{" "}
              {spec.facade.material}
              {spec.facade.columns ? " · columns" : ""}
              {spec.facade.windowShape === "arched" ? " · arched windows" : ""}
              {" · "}
              {spec.street.benches} benches · {spec.street.bins} bins
              {spec.street.fence ? " · fence" : ""}
            </p>
          )}

          <Button
            className="mt-1.5 w-full"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={handleGenerate}
          >
            {hasTexture ? (
              <>
                <Sparkles />
                Regenerate photo texture
              </>
            ) : (
              <>
                <Camera />
                Photo texture (img2img)
              </>
            )}
          </Button>

          <div className="mt-2 flex items-center justify-between">
            <Badge variant="secondary">
              {MOCK_MODE.photo ? "Photos: Commons" : "Mapillary+Commons"}
            </Badge>
            <Badge variant="secondary">
              {MOCK_MODE.image ? "Render: mock" : "Fal.ai"}
            </Badge>
          </div>
          {status && (
            <p className="mt-2 text-[11px] text-muted-foreground">{status}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
