import type { SiteView } from "@/lib/views";
import { cn } from "@/lib/utils";

const LABEL: Record<SiteView["status"], string> = {
  natura: "НАТУРА",
  eskiz: "ЭСКИЗ",
  gipoteza: "ГИПОТЕЗА",
};

const TONE: Record<SiteView["status"], string> = {
  natura: "bg-sky-500/20 text-sky-200 ring-sky-400/40",
  eskiz: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  gipoteza: "bg-amber-500/20 text-amber-100 ring-amber-300/50",
};

export default function ViewStatusBadge({
  status,
  className,
}: {
  status: SiteView["status"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] ring-1",
        TONE[status],
        className
      )}
    >
      {LABEL[status]}
    </span>
  );
}
