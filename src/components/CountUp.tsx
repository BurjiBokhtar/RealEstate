"use client";

import { useCountUp } from "@/lib/useCountUp";

const nf = new Intl.NumberFormat("ru-RU");

// An integer that animates up to its value on mount / on change. Used for the
// plain-number tiles on the dashboard so the whole board feels alive, not just
// the hero headline.
export function CountUp({
  value,
  enabled = true,
  className,
}: {
  value: number;
  enabled?: boolean;
  className?: string;
}) {
  const n = useCountUp(value, enabled);
  return <span className={`tabular-nums ${className ?? ""}`}>{nf.format(Math.round(n))}</span>;
}
