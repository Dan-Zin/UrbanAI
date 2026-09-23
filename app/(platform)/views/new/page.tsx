"use client";

import { Suspense } from "react";
import ViewEditor from "@/components/views/ViewEditor";

export default function NewViewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Загрузка кадра…</p>}>
      <ViewEditor />
    </Suspense>
  );
}
