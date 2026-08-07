"use client";

import { useState } from "react";
import { GRID_STROKE, type ChartHue } from "./palette";

export type StackSeries = { key: string; label: string; hue: ChartHue };
export type StackRow = { label: string; values: Record<string, number> };

// Vertical stacked bars: one column per building, split into its statuses.
// Each column is drawn to 100% of its own total, so the question the chart
// answers is "how much of THIS building is sold", not "which building is
// biggest" -- which is what occupancy means. The absolute count rides above
// the column so size information isn't lost.
export function StackedBarChart({
  series,
  rows,
  height = 230,
}: {
  series: StackSeries[];
  rows: StackRow[];
  height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // Which STATUS the pointer is on, not just which column. Hovering a colour
  // should tell you about that colour -- the whole-column tooltip made you read
  // five numbers to find the one you pointed at.
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const plotH = height - 40;

  return (
    <div className="w-full">
      <div className="flex gap-2" style={{ height }}>
        <div className="relative w-9 shrink-0">
          {[0, 25, 50, 75, 100].map((p) => (
            <span
              key={p}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
              style={{ bottom: `${(p / 100) * (plotH / height) * 100 + 16}%` }}
            >
              {p}%
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {[0, 25, 50, 75, 100].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${40 + (p / 100) * plotH}px`, borderColor: GRID_STROKE }}
            />
          ))}

          <div className="absolute inset-0 flex items-end justify-around gap-2 sm:gap-4">
            {rows.map((row) => {
              const total = series.reduce((s, se) => s + (row.values[se.key] ?? 0), 0);
              const isH = hover === row.label;
              return (
                <div
                  key={row.label}
                  className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(row.label)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span
                    className={`mb-1 text-center text-[10px] tabular-nums transition-colors ${
                      isH ? "font-semibold text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {total}
                  </span>
                  <div
                    className="animate-chart-grow mx-auto flex w-full max-w-[56px] flex-col-reverse overflow-hidden rounded-lg"
                    style={{
                      // See BarChart: the column is at full height from the
                      // first render; the growth is a CSS transform only.
                      height: plotH,
                      boxShadow: isH ? "0 6px 18px rgb(15 23 42 / 0.14)" : "0 2px 6px rgb(15 23 42 / 0.06)",
                    }}
                  >
                    {series.map((se) => {
                      const v = row.values[se.key] ?? 0;
                      if (!v || !total) return null;
                      const segHot = hoverKey === se.key;
                      const segDim = hoverKey !== null && !segHot;
                      return (
                        <div
                          key={se.key}
                          onMouseEnter={() => setHoverKey(se.key)}
                          onMouseLeave={() => setHoverKey(null)}
                          className="w-full transition-[filter,opacity] duration-200"
                          style={{
                            height: `${(v / total) * 100}%`,
                            background: `linear-gradient(180deg, ${se.hue.from}, ${se.hue.to})`,
                            filter: segHot ? "brightness(1.12)" : undefined,
                            opacity: segDim ? 0.32 : 1,
                          }}
                        />
                      );
                    })}
                  </div>

                  {isH && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
                      <p className="mb-1 font-semibold text-slate-700">{row.label}</p>
                      {series
                        .filter((se) => (row.values[se.key] ?? 0) > 0)
                        .map((se) => {
                          const on = hoverKey === se.key;
                          return (
                            <p
                              key={se.key}
                              className={`flex items-center gap-2 ${on ? "" : "opacity-55"}`}
                            >
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: se.hue.solid }}
                              />
                              <span className={on ? "text-slate-600" : "text-slate-400"}>
                                {se.label}
                              </span>
                              <span className="ml-auto font-semibold tabular-nums text-slate-800">
                                {row.values[se.key]}
                                {total > 0 && (
                                  <span className="ml-1.5 font-normal text-slate-400">
                                    {Math.round(((row.values[se.key] ?? 0) / total) * 100)}%
                                  </span>
                                )}
                              </span>
                            </p>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex gap-2">
        <div className="w-9 shrink-0" />
        <div className="flex min-w-0 flex-1 justify-around gap-2 sm:gap-4">
          {rows.map((row) => (
            <span
              key={`${row.label}-l`}
              className={`min-w-0 flex-1 truncate text-center text-[11px] transition-colors ${
                hover === row.label ? "font-semibold text-slate-700" : "text-slate-400"
              }`}
              title={row.label}
            >
              {row.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
