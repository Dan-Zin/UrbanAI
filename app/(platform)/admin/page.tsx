"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/initiatives/StatusBadge";
import { usePlatform } from "@/lib/platform-store";
import { CATEGORY_LABELS, STATUS_LABELS, type Category, type InitiativeStatus } from "@/lib/domain";
import { DISTRICTS } from "@/lib/seed";
import { isOverdue } from "@/lib/geo";
import { formatDate } from "@/lib/format";

const CityMap = dynamic(() => import("@/components/map/CityMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Карта…</div>,
});

export default function AdminPage() {
  const initiatives = usePlatform((s) => s.initiatives);
  const resetDemo = usePlatform((s) => s.resetDemo);
  const [status, setStatus] = useState<InitiativeStatus | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [district, setDistrict] = useState("all");

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

  const overdue = initiatives.filter(isOverdue);
  const byStatus = Object.keys(STATUS_LABELS).map((st) => ({
    st: st as InitiativeStatus,
    n: initiatives.filter((i) => i.status === st).length,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Портал администрации</h1>
          <p className="text-sm text-muted-foreground">
            Единый список, маршрутизация, сроки и тепловая карта районов.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={resetDemo}>
          Сбросить демо-данные
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {byStatus.map((s) => (
          <Card key={s.st}>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold">{s.n}</div>
              <div className="text-xs text-muted-foreground">{STATUS_LABELS[s.st]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="relative h-[360px]">
            <CityMap initiatives={filtered} mode="admin" />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Просроченные ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {overdue.length === 0 && (
              <p className="text-muted-foreground">Просроченных заявок нет.</p>
            )}
            {overdue.map((i) => (
              <Link key={i.id} href={`/initiatives/${i.id}`} className="block text-rose-300">
                {i.title} · до {formatDate(i.dueAt)}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as InitiativeStatus | "all")}
        >
          <option value="all">Статус</option>
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
          <option value="all">Категория</option>
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
          <option value="all">Район</option>
          {DISTRICTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Заявка</th>
              <th className="px-3 py-2">Район</th>
              <th className="px-3 py-2">Категория</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Приоритет</th>
              <th className="px-3 py-2">Срок</th>
              <th className="px-3 py-2">Ответственный</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-t border-white/5">
                <td className="px-3 py-2">
                  <Link href={`/initiatives/${i.id}`} className="text-emerald-300">
                    {i.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {DISTRICTS.find((d) => d.id === i.districtId)?.name}
                </td>
                <td className="px-3 py-2">{CATEGORY_LABELS[i.category]}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={i.status} />
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={i.priority} />
                </td>
                <td className={`px-3 py-2 ${isOverdue(i) ? "text-rose-300" : ""}`}>
                  {formatDate(i.dueAt)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{i.assignee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
