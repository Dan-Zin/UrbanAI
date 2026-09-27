"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/initiatives/StatusBadge";
import { usePlatform } from "@/lib/platform-store";
import { CATEGORY_LABELS, STATUS_LABELS, type InitiativeStatus } from "@/lib/domain";
import { DISTRICTS } from "@/lib/seed";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/geo";
import { allowsNaturalView, OBJECT_TYPE_LABELS, SKETCH_DISCLAIMER } from "@/lib/views";
import { buildSpecification } from "@/lib/catalog";
import { viewsForInitiative } from "@/services/views";
import ViewStatusBadge from "@/components/views/ViewStatusBadge";

const NEXT: InitiativeStatus[] = ["review", "in_progress", "done", "rejected"];

export default function InitiativePage() {
  const { id } = useParams<{ id: string }>();
  const initiatives = usePlatform((s) => s.initiatives);
  const users = usePlatform((s) => s.users);
  const currentUserId = usePlatform((s) => s.currentUserId);
  const roleView = usePlatform((s) => s.roleView);
  const voteInitiative = usePlatform((s) => s.voteInitiative);
  const commentInitiative = usePlatform((s) => s.commentInitiative);
  const changeStatus = usePlatform((s) => s.changeStatus);
  const views = usePlatform((s) => s.views);
  const [text, setText] = useState("");
  const [statusComment, setStatusComment] = useState("");

  const item = initiatives.find((i) => i.id === id);
  if (!item) {
    return <p className="p-8 text-sm text-muted-foreground">Заявка не найдена.</p>;
  }
  const author = users.find((u) => u.id === item.authorId);
  const district = DISTRICTS.find((d) => d.id === item.districtId);
  const voted = item.votes.includes(currentUserId);
  const admin = roleView !== "citizen";
  const overdue = isOverdue(item);
  const proposal = allowsNaturalView(item);
  const siteViews = viewsForInitiative(views, item.id);
  const spec = item.visualization?.placements
    ? buildSpecification(item.visualization.placements)
    : [];
  const specSum = spec.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} />
          <PriorityBadge priority={item.priority} />
          {overdue && <span className="text-xs text-rose-300">Просрочена</span>}
        </div>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          {item.address} · {district?.name} · {CATEGORY_LABELS[item.category]}
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Суть проблемы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{item.description}</p>
            {item.reformulated && (
              <p className="rounded-md border border-emerald-400/20 bg-emerald-500/10 p-3">
                <span className="text-[11px] uppercase tracking-wide text-emerald-300">
                  ИИ-формулировка
                </span>
                <br />
                {item.reformulated}
              </p>
            )}
          </CardContent>
        </Card>

        {item.visualization && (
          <Card className="glass-emerald">
            <CardHeader>
              <CardTitle>3D-эскиз</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{item.visualization.note}</p>
              <p className="text-muted-foreground">
                Объектов: {item.visualization.objectCount} · ориентир. смета{" "}
                {item.visualization.cost.toLocaleString("ru-RU")} ₽
              </p>
              {spec.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-white/10">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">Наименование</th>
                        <th className="px-2 py-1.5 font-medium">Артикул</th>
                        <th className="px-2 py-1.5 font-medium">Производитель</th>
                        <th className="px-2 py-1.5 font-medium">Габариты (Д × Ш × В)</th>
                        <th className="px-2 py-1.5 font-medium">Материал</th>
                        <th className="px-2 py-1.5 font-medium">Цвет</th>
                        <th className="px-2 py-1.5 font-medium">Вес</th>
                        <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                        <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.map((line) => (
                        <tr key={line.key} className="border-t border-white/5">
                          <td className="px-2 py-1.5">{line.label}</td>
                          <td className="px-2 py-1.5">{line.article}</td>
                          <td className="px-2 py-1.5">{line.manufacturer}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{line.dimensions}</td>
                          <td className="px-2 py-1.5">{line.material}</td>
                          <td className="px-2 py-1.5">{line.colorName}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{line.weightLabel}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{line.qty}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {(line.unitPrice * line.qty).toLocaleString("ru-RU")} ₽
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-white/10 font-medium">
                        <td className="px-2 py-1.5" colSpan={8}>
                          Итого
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {specSum.toLocaleString("ru-RU")} ₽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Спецификация появится после сохранения сцены: откройте студию и прикрепите эскиз ещё раз.
                </p>
              )}
              <Link
                href={`/studio?lng=${item.lng}&lat=${item.lat}&initiative=${item.id}`}
              >
                <Button size="sm" variant="outline">
                  Открыть в студии
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Комментарии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.comments.map((c) => (
              <div key={c.id} className="rounded-md border border-white/10 p-3 text-sm">
                <div className="text-[11px] text-muted-foreground">
                  {users.find((u) => u.id === c.authorId)?.name} · {formatDate(c.createdAt)}
                </div>
                <p className="mt-1">{c.text}</p>
              </div>
            ))}
            <textarea
              className="min-h-20 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
              placeholder="Комментарий"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!text.trim()}
              onClick={() => {
                commentInitiative(item.id, text);
                setText("");
              }}
            >
              Отправить
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <div>Автор: {author?.name}</div>
            <div>Ответственный: {item.assignee}</div>
            <div>Срок: {formatDate(item.dueAt)}</div>
            <div>Голосов: {item.votes.length}</div>
            <Button
              className="w-full"
              variant={voted ? "secondary" : "default"}
              onClick={() => voteInitiative(item.id)}
              disabled={voted}
            >
              {voted ? "Вы уже поддержали" : "Поддержать"}
            </Button>
            {!item.visualization && (
              <Link href={`/studio?lng=${item.lng}&lat=${item.lat}&initiative=${item.id}`}>
                <Button className="w-full" variant="outline">
                  Добавить 3D-эскиз
                </Button>
              </Link>
            )}
            {proposal ? (
              <Link href={`/views/new?initiative=${item.id}&lng=${item.lng}&lat=${item.lat}`}>
                <Button className="w-full" variant="outline">
                  Натурный вид
                </Button>
              </Link>
            ) : (
              <div className="space-y-1">
                <Button className="w-full" variant="outline" disabled>
                  Натурный вид
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Оперативный дефект: только фото и классификация. Перерисовка двора отключена.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Натурные виды</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {siteViews.length === 0 && (
              <p className="text-muted-foreground">Кадры места хранятся только в этой заявке.</p>
            )}
            {siteViews.map((view) => (
              <div key={view.id} className="space-y-2 rounded-md border border-white/10 p-2">
                <img
                  src={view.resultImageDataUrl || view.imageDataUrl}
                  alt="Кадр натурного вида"
                  className="max-h-40 w-full rounded object-cover"
                />
                <div className="flex items-center gap-2">
                  <ViewStatusBadge status={view.status} />
                  <span className="text-[11px] text-muted-foreground">{SKETCH_DISCLAIMER}</span>
                </div>
                {view.objects.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Объектов эскиза нет</p>
                ) : (
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    {view.objects.map((object) => (
                      <li key={object.id}>
                        {OBJECT_TYPE_LABELS[object.type]} · {object.status}
                        {object.placedWithGeometry ? "" : " · без привязки к плоскости"}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/studio?lng=${item.lng}&lat=${item.lat}&initiative=${item.id}&view=${view.id}`}
                  >
                    <Button size="sm" variant="outline">
                      Открыть в студии
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => commentInitiative(item.id, "Житель подтвердил этот эскиз")}
                  >
                    Житель подтвердил этот эскиз
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История статусов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {item.history.map((h, idx) => (
              <div key={idx} className="border-l border-emerald-400/30 pl-3">
                <div className="text-[11px] text-muted-foreground">{formatDate(h.at)}</div>
                <div className="font-medium">{STATUS_LABELS[h.status]}</div>
                <p className="text-muted-foreground">{h.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {admin && (
          <Card>
            <CardHeader>
              <CardTitle>Действия администрации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                className="min-h-16 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="Комментарий к смене статуса"
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {NEXT.map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant="outline"
                    disabled={st === "rejected" && !statusComment.trim()}
                    onClick={() => {
                      changeStatus(
                        item.id,
                        st,
                        statusComment || `Статус: ${STATUS_LABELS[st]}`,
                        st === "done"
                      );
                      setStatusComment("");
                    }}
                  >
                    {STATUS_LABELS[st]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
