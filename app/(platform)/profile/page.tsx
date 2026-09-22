"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/initiatives/StatusBadge";
import { usePlatform } from "@/lib/platform-store";
import { LEVEL_LABELS } from "@/lib/domain";
import { ACHIEVEMENTS, levelFromPoints, levelProgress } from "@/lib/gamification";
import { DISTRICTS } from "@/lib/seed";

export default function ProfilePage() {
  const user = usePlatform((s) => s.users.find((u) => u.id === s.currentUserId));
  const initiatives = usePlatform((s) => s.initiatives);
  if (!user) return null;
  const mine = initiatives.filter((i) => i.authorId === user.id);
  const level = levelFromPoints(user.points);
  const progress = levelProgress(user.points);
  const district = DISTRICTS.find((d) => d.id === user.districtId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-emerald-950"
          style={{ background: `hsl(${user.avatarHue} 70% 55%)` }}
        >
          {user.name.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            @{user.nickname} · {district?.name} · {LEVEL_LABELS[level]}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>{user.points} баллов</span>
            <span className="text-muted-foreground">до следующего уровня {progress.next}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Подано" value={mine.length} />
        <Stat label="Выполнено" value={mine.filter((i) => i.status === "done").length} />
        <Stat
          label="Комментариев"
          value={initiatives.reduce(
            (n, i) => n + i.comments.filter((c) => c.authorId === user.id).length,
            0
          )}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Достижения</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ACHIEVEMENTS.map((a) => (
            <Badge
              key={a.id}
              variant={user.achievements.includes(a.id) ? "default" : "secondary"}
              title={a.condition}
            >
              {a.title}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Мои инициативы</h2>
        {mine.map((item) => (
          <Link key={item.id} href={`/initiatives/${item.id}`} className="block">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.address}</div>
                </div>
                <StatusBadge status={item.status} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold text-emerald-300">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
