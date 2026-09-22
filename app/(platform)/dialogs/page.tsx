"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlatform } from "@/lib/platform-store";
import { formatDate } from "@/lib/format";
import type { MeetingType } from "@/lib/domain";

const TYPE: Record<MeetingType, string> = {
  yard: "Дворовый чат",
  district: "Районный совет",
  workgroup: "Рабочая группа",
  open: "Открытая дискуссия",
};

export default function DialogsPage() {
  const meetings = usePlatform((s) => s.meetings);
  const joinMeeting = usePlatform((s) => s.joinMeeting);
  const createMeeting = usePlatform((s) => s.createMeeting);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Городские диалоги</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Видеовстречи, привязанные к инициативе или территории. В продакшене — self-hosted Jitsi Meet,
          транскрипт и ИИ-протокол.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Создать встречу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            placeholder="Тема"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="min-h-20 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm"
            placeholder="Повестка"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
          <Button
            disabled={!title.trim()}
            onClick={() => {
              createMeeting({
                title,
                agenda: agenda || "Обсуждение инициативы",
                type: "open",
                when: new Date(Date.now() + 86400000).toISOString(),
                maxParticipants: 50,
              });
              setTitle("");
              setAgenda("");
            }}
          >
            Запланировать
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {meetings.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{m.title}</div>
                  <Badge variant="secondary">{TYPE[m.type]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{m.agenda}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(m.when)} · {m.participants}/{m.maxParticipants}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => joinMeeting(m.id)}>
                Присоединиться
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
