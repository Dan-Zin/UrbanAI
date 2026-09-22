import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type Category,
  type InitiativeStatus,
} from "./domain";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  });
}

export function statusTone(status: InitiativeStatus): "default" | "secondary" | "warning" | "danger" {
  if (status === "done") return "default";
  if (status === "rejected") return "danger";
  if (status === "in_progress") return "warning";
  return "secondary";
}

export function categoryLabel(c: Category) {
  return CATEGORY_LABELS[c];
}

export function statusLabel(s: InitiativeStatus) {
  return STATUS_LABELS[s];
}

export function districtColor(color: "red" | "yellow" | "green") {
  if (color === "red") return "#f43f5e";
  if (color === "yellow") return "#f59e0b";
  return "#34d399";
}
