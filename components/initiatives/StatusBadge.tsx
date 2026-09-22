"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, PRIORITY_LABELS, type InitiativeStatus, type Priority } from "@/lib/domain";
import { statusTone } from "@/lib/format";

export function StatusBadge({ status }: { status: InitiativeStatus }) {
  return <Badge variant={statusTone(status)}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={priority === "urgent" ? "danger" : priority === "high" ? "warning" : "secondary"}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
