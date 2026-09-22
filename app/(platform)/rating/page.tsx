"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlatform } from "@/lib/platform-store";
import { DISTRICTS } from "@/lib/seed";
import { LEVEL_LABELS } from "@/lib/domain";
import { districtScore, levelFromPoints } from "@/lib/gamification";

export default function RatingPage() {
  const users = usePlatform((s) => s.users);
  const initiatives = usePlatform((s) => s.initiatives);
  const citizens = users
    .filter((u) => u.role === "citizen")
    .slice()
    .sort((a, b) => b.points - a.points);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Рейтинг граждан</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {citizens.map((u, idx) => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="w-6 text-muted-foreground">{idx + 1}</span>
                <span>{u.name}</span>
                <span className="text-xs text-muted-foreground">
                  {LEVEL_LABELS[levelFromPoints(u.points)]}
                </span>
              </div>
              <span className="text-emerald-300">{u.points} б.</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Рейтинг районов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DISTRICTS.map((d) => {
            const items = initiatives.filter((i) => i.districtId === d.id);
            const score = districtScore(items);
            const open = items.filter((i) => i.status !== "done" && i.status !== "rejected").length;
            return (
              <div key={d.id} className="text-sm">
                <div className="flex justify-between">
                  <span>{d.name}</span>
                  <span
                    className={
                      score.color === "green"
                        ? "text-emerald-300"
                        : score.color === "yellow"
                          ? "text-amber-300"
                          : "text-rose-300"
                    }
                  >
                    {Math.round(score.resolvedShare * 100)}% решено
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {items.length} заявок · открытых {open} · средний срок{" "}
                  {score.avgDays.toFixed(1)} дн.
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
