"use client";

import { Suspense } from "react";
import StudioApp from "@/components/studio/StudioApp";
import StudioBridge from "@/components/studio/StudioBridge";

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Загрузка студии…
        </div>
      }
    >
      <StudioBridge />
      <StudioApp />
    </Suspense>
  );
}
