"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ConstructionStatus } from "@/lib/buildings/types";

// Same visual language across the buildings list, the shakhmatka header and
// the dashboard filter -- so a "completed" ЖК always reads the same shade of
// grey wherever it shows up.
const COLORS: Record<ConstructionStatus, string> = {
  planning: "bg-sky-100 text-sky-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-slate-200 text-slate-600",
};

export function ConstructionStatusBadge({
  status,
  className,
}: {
  status: ConstructionStatus;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLORS[status]} ${className ?? ""}`}
    >
      {t.buildings.constructionStatuses[status]}
    </span>
  );
}
