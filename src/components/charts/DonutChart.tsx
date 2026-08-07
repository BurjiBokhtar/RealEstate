"use client";

import { useState } from "react";
import type { ChartHue } from "./palette";

export type DonutSlice = { key: string; label: string; value: number; hue: ChartHue };

// A donut with a live centre readout: hovering a slice puts that slice's
// figure in the middle, and with nothing hovered the middle carries the total.
// A ring rather than a pie because the centre is the most valuable space on
// the chart -- a pie throws it away.
export function DonutChart({
  slices,
  size = 210,
  thickness = 30,
  centerLabel,
  formatValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const active = hover ? slices.find((s) => s.key === hover) : null;

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="animate-chart-donut -rotate-90" role="img">
          {/* Track, so a nearly-empty donut still reads as a ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {total > 0 &&
            slices.map((s) => {
              const frac = s.value / total;
              // Full arc from the first render -- the ring animates in via CSS.
              const len = frac * c;
              const dash = `${len} ${c - len}`;
              const thisOffset = offset;
              offset += frac * c;
              const dim = hover !== null && hover !== s.key;
              return (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.hue.solid}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-thisOffset}
                  strokeLinecap="butt"
                  opacity={dim ? 0.28 : 1}
                  className="cursor-pointer transition-[opacity,filter] duration-200"
                  style={{
                    filter:
                      hover === s.key ? `brightness(1.12) drop-shadow(0 0 6px ${s.hue.solid}88)` : undefined,
                  }}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {active ? active.label : centerLabel}
          </span>
          <span className="text-lg font-bold leading-tight text-slate-900">
            {formatValue(active ? active.value : total)}
          </span>
          {active && total > 0 && (
            <span className="text-xs font-semibold" style={{ color: active.hue.solid }}>
              {Math.round((active.value / total) * 100)}%
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {slices.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm transition-colors ${
              hover === s.key ? "bg-slate-50" : ""
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.hue.solid }}
            />
            <span className="text-slate-500">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-slate-800">
              {formatValue(s.value)}
            </span>
            {total > 0 && (
              <span className="w-9 text-right text-xs tabular-nums text-slate-400">
                {Math.round((s.value / total) * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
