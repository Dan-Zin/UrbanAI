"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlatform } from "@/lib/platform-store";
import { mockAssist, similarInitiatives } from "@/lib/ai-assist";
import { findDistrict, reverseGeocode } from "@/lib/geo";
import { DISTRICTS } from "@/lib/seed";
import { CATEGORY_LABELS, PRIORITY_LABELS, type AssistResult } from "@/lib/domain";
import { TAGANROG_CENTER } from "@/lib/store";

const CityMap = dynamic(() => import("@/components/map/CityMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Карта…</div>,
});

export default function NewInitiativePage() {
  const router = useRouter();
  const initiatives = usePlatform((s) => s.initiatives);
  const createInitiative = usePlatform((s) => s.createInitiative);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pick, setPick] = useState<{ lng: number; lat: number } | null>({
    lng: TAGANROG_CENTER[0],
    lat: TAGANROG_CENTER[1],
  });
  const [assist, setAssist] = useState<AssistResult | null>(null);

  const address = pick ? reverseGeocode(pick.lng, pick.lat) : "";
  const district = pick ? findDistrict(pick.lng, pick.lat, DISTRICTS) : null;
  const similar = useMemo(
    () =>
      pick
        ? similarInitiatives(description || title, district?.id ?? "central", initiatives)
        : [],
    [description, title, district, initiatives, pick]
  );

  const runAssist = () => {
    if (!pick) return;
    setAssist(mockAssist(description || title, address, similar));
  };

  const submit = () => {
    if (!pick || !description.trim()) return;
    const item = createInitiative({
      title,
      description,
      lng: pick.lng,
      lat: pick.lat,
    });
    router.push(`/initiatives/${item.id}`);
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="text-2xl font-semibold">Новая инициатива</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Отметьте точку на карте Таганрога, опишите проблему своими словами — ИИ поможет с формулировкой.
        </p>
        <div className="relative mt-4 h-[360px] overflow-hidden rounded-xl border border-white/10">
          <CityMap
            initiatives={initiatives}
            mode="pick"
            pick={pick}
            onPick={(lng, lat) => setPick({ lng, lat })}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {address}
          {district ? ` · ${district.name}` : ""}
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Описание</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Короткий заголовок"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-32 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Что не так, где именно, чем мешает"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={runAssist} type="button">
                ИИ-помощник
              </Button>
              <Link
                href={`/studio?lng=${pick?.lng ?? ""}&lat=${pick?.lat ?? ""}`}
              >
                <Button variant="secondary" size="sm" type="button">
                  Открыть 3D-студию на этой точке
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {assist && (
          <Card className="glass-emerald">
            <CardHeader>
              <CardTitle>Предложение ИИ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{CATEGORY_LABELS[assist.category]}</Badge>
                <Badge variant="secondary">{PRIORITY_LABELS[assist.priority]}</Badge>
                <Badge variant="secondary">
                  уверенность {Math.round(assist.categoryConfidence * 100)}%
                </Badge>
              </div>
              <p>{assist.reformulated}</p>
              {assist.validationHint && (
                <p className="text-amber-300">{assist.validationHint}</p>
              )}
              {assist.mock && (
                <p className="text-[11px] text-muted-foreground">
                  Демо-режим: классификация по правилам. При ключе LLM ответ пойдёт через API.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {similar.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Похожие заявки рядом</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {similar.map((s) => (
                <Link key={s.id} href={`/initiatives/${s.id}`} className="block text-emerald-300">
                  {s.title}
                </Link>
              ))}
              <p className="text-xs text-muted-foreground">
                Если проблема уже описана — лучше поддержать существующую заявку.
              </p>
            </CardContent>
          </Card>
        )}

        <Button className="w-full" onClick={submit} disabled={!description.trim() || !pick}>
          Отправить инициативу
        </Button>
      </div>
    </div>
  );
}
