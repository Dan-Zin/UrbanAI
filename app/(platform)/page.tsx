"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHasHydrated, usePlatform } from "@/lib/platform-store";
import { DISTRICTS } from "@/lib/seed";
import { districtScore } from "@/lib/gamification";
import { STATUS_LABELS } from "@/lib/domain";

const STEPS = [
  {
    title: "Точка на карте",
    text: "Житель отмечает место, добавляет фото и описание. Улица и район определяются сами.",
  },
  {
    title: "ИИ-помощник",
    text: "Система предлагает формулировку, категорию и приоритет. Похожие заявки — чтобы не плодить дубли.",
  },
  {
    title: "3D-эскиз двора",
    text: "На площадке 40×40 м расставляются скамейки, деревья, фонари — видно, что именно предлагается.",
  },
  {
    title: "Маршрутизация",
    text: "Заявка за минуту попадает ответственному по району и категории. Статусы прозрачны.",
  },
];

const GAPS = [
  "Нет модели «точка на карте → инициатива → статус»",
  "Повестку задаёт власть, жители только голосуют",
  "Нет 3D-визуализации благоустройства",
  "Нет мониторинга после реализации",
];

export default function LandingPage() {
  const hydrated = useHasHydrated();
  const initiatives = usePlatform((s) => s.initiatives);
  const users = usePlatform((s) => s.users);
  const done = initiatives.filter((i) => i.status === "done").length;
  const open = initiatives.filter((i) => i.status !== "done" && i.status !== "rejected").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Badge className="mb-4">Пилот · г. Таганрог</Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Город, где житель{" "}
            <span className="text-emerald-400 text-glow">соавтор</span> двора,
            а не заявитель в очереди
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Платформа территориально-контекстного участия: заявка с карты,
            ИИ-обработка, 3D-эскиз благоустройства, рейтинг районов и кабинет
            администрации. Вместо голосования за готовые объекты — инициатива снизу.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/map">
              <Button size="lg">
                Открыть карту <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/initiatives/new">
              <Button size="lg" variant="outline">
                Подать инициативу
              </Button>
            </Link>
            <Link href="/studio">
              <Button size="lg" variant="secondary">
                <Boxes className="h-4 w-4" />
                3D-студия
              </Button>
            </Link>
          </div>
        </div>
        <Card className="glass-emerald">
          <CardHeader>
            <CardTitle>Сейчас в пилоте</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Инициатив" value={hydrated ? String(initiatives.length) : "—"} />
            <Stat label="В работе" value={hydrated ? String(open) : "—"} />
            <Stat label="Выполнено" value={hydrated ? String(done) : "—"} />
            <Stat
              label="Жителей"
              value={hydrated ? String(users.filter((u) => u.role === "citizen").length) : "—"}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  <span className="mr-2 text-emerald-400">0{i + 1}</span>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.text}</CardContent>
            </Card>
          </motion.div>
        ))}
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Почему не «Сделаем вместе» и не ФКГС</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {GAPS.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-rose-400">✕</span>
                  {g}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              Наш контур: точка на карте → ИИ → 3D-эскиз → диалог → результат.
              Развёртывание — SaaS или on-premise, данные в РФ.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Районы Таганрога</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DISTRICTS.map((d) => {
              const items = initiatives.filter((i) => i.districtId === d.id);
              const score = districtScore(items);
              return (
                <div key={d.id} className="flex items-center justify-between text-sm">
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
                    {items.length} заявок · {Math.round(score.resolvedShare * 100)}% решено
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <Feature
          icon={Sparkles}
          title="ИИ-помощник"
          text="Категория, формулировка, приоритет и проверка полноты заявки."
        />
        <Feature
          icon={Boxes}
          title="ИИ-визуализация"
          text="Каталог МАФ, генерация объекта по тексту/фото, смета и тени на площадке."
        />
        <Feature
          icon={Trophy}
          title="Геймификация"
          text="Баллы, уровни, достижения, рейтинг граждан и районов."
        />
        <Feature
          icon={MapPin}
          title="Маршрутизация"
          text="Район + категория → ответственный. Просрочки подсвечиваются."
        />
        <Feature
          icon={ShieldCheck}
          title="Кабинет администрации"
          text="Единый список, тепловая карта, смена статусов, аналитика."
        />
        <Feature
          icon={Video}
          title="Городские диалоги"
          text="Видеовстречи, привязанные к заявке или двору. Демо-контур Jitsi."
        />
      </section>

      <section className="mt-16">
        <h2 className="mb-4 text-lg font-semibold">Последние инициативы</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {initiatives.slice(0, 4).map((item) => (
            <Link key={item.id} href={`/initiatives/${item.id}`}>
              <Card className="h-full transition-colors hover:border-emerald-400/30">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3">
                    <span>{item.title}</span>
                    <Badge variant="secondary">{STATUS_LABELS[item.status]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {item.address}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-emerald-300">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
