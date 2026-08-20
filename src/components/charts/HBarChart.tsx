"use client";

import { useState } from "react";
import { compactNumber, hueAt, type ChartHue } from "./palette";

export type HBarDatum = { label: string; value: number; hue?: ChartHue; hint?: string };

// Horizontal bars, sorted longest first.
//
// Chosen over vertical columns wherever the categories are NAMES rather than
// dates: "Кайҳонавадон 36 Б" under a 40px column either truncates or wraps into
// the neighbour, while beside a horizontal bar it has the whole card width. It
// is also the natural shape for a ranking, which is what "who owes most" is.
//
// Hovering a bar lifts it and dims the rest, so the row being read is never
// competing with the others for attention.
export function HBarChart({
  data,
  formatValue = compactNumber,
}: {
  data: HBarDatum[];
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d, i) => {
        const hue = d.hue ?? hueAt(i);
        const frac = max > 0 ? d.value / max : 0;
        const dim = hover !== null && hover !== i;
        return (
          <li
            key={`${d.label}-${i}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="flex flex-col gap-1 transition-opacity"
            style={{ opacity: dim ? 0.4 : 1 }}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--ink-2)]" title={d.label}>
                {d.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--ink-1)]">
                {formatValue(d.value)}
              </span>
            </div>
            {/* Scaling the track itself (not the fill inside it) means the
                lift never fights the track's overflow-hidden -- a taller
                fill would just get clipped back to the old height. */}
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--track-c)] transition-transform duration-200"
              style={{ transform: hover === i ? "scaleY(1.4)" : undefined }}
            >
              <div
                className="animate-chart-grow-x h-full rounded-full transition-[filter]"
                style={{
                  width: `${frac * 100}%`,
                  minWidth: d.value > 0 ? 6 : 0,
                  animationDelay: `${i * 60}ms`,
                  background: `linear-gradient(90deg, ${hue.from}, ${hue.to})`,
                  boxShadow: hover === i ? `0 2px 10px ${hue.solid}66` : undefined,
                  filter: hover === i ? "brightness(1.08)" : undefined,
                }}
              />
            </div>
            {d.hint && <span className="text-[11px] text-[var(--ink-5)]">{d.hint}</span>}
          </li>
        );
      })}
    </ul>
  );
}
