"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlatform } from "@/lib/platform-store";

const TYPE: Record<string, string> = {
  street: "Улица / двор",
  thematic: "Тема",
  district: "Район",
};

export default function CommunityPage() {
  const communities = usePlatform((s) => s.communities);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Сообщества</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Улицы, районы и тематические группы. В полном контуре — лента, чаты и голосования.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {communities.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {c.name}
                <Badge variant="secondary">{TYPE[c.type]}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{c.description}</p>
              <p className="mt-2">{c.members} участников</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
