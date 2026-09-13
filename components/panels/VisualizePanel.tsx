"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ImageIcon, LoaderCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { generateVisualization, MOCK_MODE } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Builds a text prompt describing the current 3D scene. */
function useScenePrompt(): string {
  const selected = useStore((s) => s.selected);
  const objects = useStore((s) => s.objects);
  if (!selected) return "";
  const counts = objects.reduce<Record<string, number>>((acc, o) => {
    acc[o.label] = (acc[o.label] ?? 0) + 1;
    return acc;
  }, {});
  const items =
    Object.entries(counts)
      .map(([label, n]) => `${n}x ${label.toLowerCase()}`)
      .join(", ") || "an empty renovated plaza";
  return `10x10m public space in Taganrog at ${selected.lat.toFixed(4)}N ${selected.lng.toFixed(4)}E with ${items}`;
}

export default function VisualizePanel() {
  const selected = useStore((s) => s.selected);
  const prompt = useScenePrompt();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVisualize = async () => {
    setLoading(true);
    setError(null);
    try {
      setImage(await generateVisualization(prompt));
    } catch {
      setError("Generation failed — check your Fal.ai key or try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-emerald-400" />
          Generative Design
        </CardTitle>
        <Badge variant="secondary">{MOCK_MODE.image ? "Mock" : "Fal.ai"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {prompt && (
          <p className="line-clamp-2 rounded-md bg-black/30 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-emerald-200/70">
            {prompt}
          </p>
        )}

        <Button
          className="w-full"
          disabled={!selected || loading}
          onClick={handleVisualize}
        >
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" />
              Rendering vision…
            </>
          ) : (
            <>
              <Sparkles />
              Visualize
            </>
          )}
        </Button>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <AnimatePresence>
          {image && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden rounded-lg border border-emerald-400/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="AI generated urban design render"
                className="w-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
