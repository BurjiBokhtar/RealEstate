"use client";

import { useCountUp } from "@/lib/useCountUp";

export type MoneyPair = { tjs: number; usd: number };

const nf = new Intl.NumberFormat("ru-RU");

function Amount({ value, animate }: { value: number; animate: boolean }) {
  const n = useCountUp(value, animate);
  return <>{nf.format(Math.round(n))}</>;
}

// A polished multi-currency figure. Each currency sits on its own line: the
// amount bold, the ISO code set small, letter-spaced and muted beside it --
// like a proper financial readout, never a crude "241 360 TJS + 13 710 USD".
// When a second currency is present it's rendered smaller and quieter, so the
// primary figure leads the eye. Sizes are em-relative, so the same component
// fits a hero, a stat card or a table cell just by inheriting the surrounding
// font-size. Pass `animate` to have the amounts count up on the dashboard.
export function MoneyPairValue({
  value,
  align = "left",
  animate = false,
}: {
  value: MoneyPair;
  align?: "left" | "right";
  animate?: boolean;
}) {
  const parts: Array<{ amount: number; code: string }> = [];
  if (value.tjs > 0) parts.push({ amount: value.tjs, code: "TJS" });
  if (value.usd > 0) parts.push({ amount: value.usd, code: "USD" });
  if (parts.length === 0) return <span className="opacity-40">—</span>;

  return (
    <span
      className={`flex flex-col gap-1 leading-none ${
        align === "right" ? "items-end" : "items-start"
      }`}
    >
      {parts.map((p, i) => (
        <span
          key={p.code}
          className={`flex items-baseline gap-1.5 tabular-nums ${
            i > 0 ? "opacity-60" : ""
          }`}
        >
          <span className={`font-bold ${i > 0 ? "text-[0.66em]" : ""}`}>
            <Amount value={p.amount} animate={animate} />
          </span>
          <span className="text-[0.5em] font-semibold uppercase tracking-[0.12em] opacity-65">
            {p.code}
          </span>
        </span>
      ))}
    </span>
  );
}
