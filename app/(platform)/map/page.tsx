"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/initiatives/StatusBadge";
import { usePlatform } from "@/lib/platform-store";
import { CATEGORY_LABELS, STATUS_LABELS, type Category, type InitiativeStatus } from "@/lib/domain";
import { DISTRICTS } from "@/lib/seed";

const CityMap = dynamic(() => import("@/components/map/CityMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Карта…</div>,
});

export default function MapPage() {
  const initiatives = usePlatform((s) => s.initiatives);
  const [status, setStatus] = useState<InitiativeStatus | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [district, setDistrict] = useState<string>("all");

  const filtered = useMemo(
    () =>
      initiatives.filter((i) => {
        if (status !== "all" && i.status !== status) return false;
        if (category !== "all" && i.category !== category) return false;
        if (district !== "all" && i.districtId !== district) return false;
        return true;
      }),
    [initiatives, status, category, district]
  );

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.4fr_0.9fr]">
      <div className="relative min-h-[420px] border-b border-white/10 lg:border-b-0 lg:border-r">
        <CityMap initiatives={filtered} mode="browse" />
      </div>
      <div className="flex max-h-[calc(100vh-4rem)] flex-col">
        <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
          <select
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value as InitiativeStatus | "all")}
          >
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
          >
            <option value="all">Все категории</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="all">Все районы</option>
            {DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Link href="/initiatives/new" className="ml-auto">
            <Button size="sm">Подать</Button>
          </Link>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
          {filtered.map((item) => (
            <Link key={item.id} href={`/initiatives/${item.id}`}>
              <Card className="mb-2 hover:border-emerald-400/30">
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{item.title}</div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">{item.address}</div>
                  <div className="flex flex-wrap gap-1">
                    <PriorityBadge priority={item.priority} />
                    <span className="text-[11px] text-muted-foreground">
                      {CATEGORY_LABELS[item.category]} · {item.votes.length} голосов
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Нет заявок по фильтру</p>
          )}
        </div>
      </div>
    </div>
  );
}
