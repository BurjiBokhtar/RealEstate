"use client";

import { useId, useState } from "react";
import { AXIS_TEXT, GRID_STROKE, axisTicks, compactNumber } from "./palette";

export type AreaSeries = { key: string; label: string; color: string; values: number[] };

// A line-and-area chart: gradient fill under a smooth stroke, a ring marker on
// every point, gridlines behind, and a card tooltip on hover.
//
// SVG with a fixed viewBox and preserveAspectRatio="none" would stretch the
// stroke unevenly, so the plot is laid out in real pixels from a measured
// width instead. The container reports its width and the paths are rebuilt --
// no dependency on a chart library, and nothing gets squashed on a phone.
export function AreaChart({
  labels,
  series,
  height = 200,
  formatValue = compactNumber,
}: {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  // Which series the pointer is over (via the legend or a dot), so the other
  // line can step back instead of both shouting at once.
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);

  const PAD_L = 44;
  const PAD_R = 10;
  const PAD_T = 12;
  const PAD_B = 26;
  // A wide-enough virtual canvas; the SVG scales to the card via width:100%.
  const W = 720;
  const H = height;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allMax = Math.max(...series.flatMap((s) => s.values), 0);
  const { top, ticks } = axisTicks(allMax);

  const x = (i: number) =>
    labels.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i * plotW) / (labels.length - 1);
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.key} id={`${uid}-g${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines + value axis */}
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(tv)} y2={y(tv)} stroke={GRID_STROKE} />
            <text x={PAD_L - 8} y={y(tv) + 3} textAnchor="end" className={AXIS_TEXT}>
              {formatValue(tv)}
            </text>
          </g>
        ))}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const areaPath = `M ${x(0)},${y(0)} L ${s.values
            .map((v, i) => `${x(i)},${y(v)}`)
            .join(" L ")} L ${x(s.values.length - 1)},${y(0)} Z`;
          return (
            <g
              key={s.key}
              // CSS-only reveal, so the line is drawn correctly even if the
              // animation never plays.
              className="animate-chart-fade transition-opacity duration-200"
              style={{
                animationDelay: `${si * 90}ms`,
                opacity: hoverSeries && hoverSeries !== s.key ? 0.25 : 1,
              }}
              onMouseEnter={() => setHoverSeries(s.key)}
              onMouseLeave={() => setHoverSeries(null)}
            >
              <path d={areaPath} fill={`url(#${uid}-g${si})`} />
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={hover === i ? 5.5 : 4}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth="2.5"
                  className="transition-all"
                />
              ))}
            </g>
          );
        })}

        {/* One hit area per column, so hovering anywhere in the column works --
            not just exactly on the 4px dot. */}
        {labels.map((lb, i) => (
          <g key={lb}>
            <rect
              x={x(i) - plotW / Math.max(labels.length, 1) / 2}
              y={PAD_T}
              width={plotW / Math.max(labels.length, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {hover === i && (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD_T}
                y2={PAD_T + plotH}
                stroke={GRID_STROKE}
                strokeWidth="2"
              />
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" className={AXIS_TEXT}>
              {lb}
            </text>
          </g>
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(Math.max(...series.map((s) => s.values[hover] ?? 0))) / H) * 100 - 4}%` }}
        >
          <p className="mb-1 font-semibold text-slate-700">{labels[hover]}</p>
          {series
            .filter((s) => (s.values[hover] ?? 0) > 0)
            .map((s) => (
              <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-slate-400">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-800">
                  {formatValue(s.values[hover] ?? 0)}
                </span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
