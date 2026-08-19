"use client";

import { useState } from "react";
import type { ChartHue } from "./palette";

export type StackSegment = { key: string; label: string; value: number; hue: ChartHue };

// One part-to-whole bar, drawn to 100% of its own total.
//
// This replaces a donut. A donut needs a square of roughly 200x200 to be
// readable, which forces it into a card of its own and leaves the rest of the
// row empty; the same three shares fit in a 14px strip that sits under the
// figures it explains. Reading a length against a length is also more exact
// than reading one arc against another -- the reason the ranking charts on
// this dashboard are bars rather than rings.
//
// Segments are separated by a 2px gap in the surface colour rather than a
// stroke, so the divider belongs to the background instead of adding a border
// to every band.
export function StackBar({
  segments,
  formatValue,
}: {
  segments: StackSegment[];
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const share = (v: number) => (v / total) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3.5 gap-0.5">
        {segments.map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            title={`${s.label}: ${formatValue(s.value)}`}
            // Grows upward from the strip's own baseline, the same lift a
            // hovered horizontal bar gets -- nothing above the strip clips
            // it, so the segment just rises a little rather than resizing
            // in place.
            className="animate-chart-grow-x h-full first:rounded-l-full last:rounded-r-full transition-[opacity,transform]"
            style={{
              width: `${share(s.value)}%`,
              background: `linear-gradient(90deg, ${s.hue.from}, ${s.hue.to})`,
              opacity: hover && hover !== s.key ? 0.4 : 1,
              transform: hover === s.key ? "scaleY(1.4)" : undefined,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>

      {/* The legend carries the numbers, so no label is ever squeezed inside a
          band it doesn't fit. Percentages are rounded for reading, which is
          why they are shown beside the exact figure rather than instead. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-2 text-xs text-slate-500 transition-opacity"
            style={{ opacity: hover && hover !== s.key ? 0.4 : 1 }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.hue.solid }} />
            {s.label}
            <span className="font-semibold tabular-nums text-slate-900">{formatValue(s.value)}</span>
            <span className="tabular-nums text-slate-400">{Math.round(share(s.value))}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
