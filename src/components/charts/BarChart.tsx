"use client";

import { useState } from "react";
import { GRID_STROKE, axisTicks, compactNumber, hueAt, type ChartHue } from "./palette";

export type BarDatum = { label: string; value: number; hue?: ChartHue; hint?: string };

// Vertical bars, each its own saturated hue, rounded at the top, growing up
// from the baseline on mount. Gridlines and a value axis behind them so the
// heights can actually be read off rather than just compared.
//
// Built with divs rather than SVG: the bars need a CSS gradient, a rounded cap
// and a blurred glow at the foot, all of which are one line each in CSS and
// fiddly in SVG.
export function BarChart({
  data,
  height = 230,
  formatValue = compactNumber,
  formatTooltip,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (n: number) => string;
  formatTooltip?: (d: BarDatum) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 0);
  const { top, ticks } = axisTicks(max);

  return (
    <div className="w-full">
      <div className="flex gap-2" style={{ height }}>
        {/* Value axis */}
        <div className="relative w-11 shrink-0">
          {ticks.map((tv) => (
            <span
              key={tv}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
              style={{ bottom: `${(tv / top) * 100}%` }}
            >
              {formatValue(tv)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines */}
          {ticks.map((tv) => (
            <div
              key={tv}
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${(tv / top) * 100}%`, borderColor: GRID_STROKE }}
            />
          ))}

          <div className="absolute inset-0 flex items-end justify-around gap-1.5 sm:gap-3">
            {data.map((d, i) => {
              const hue = d.hue ?? hueAt(i);
              const frac = top > 0 ? d.value / top : 0;
              const isH = hover === i;
              return (
                <div
                  key={`${d.label}-${i}`}
                  className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="relative mx-auto w-full max-w-[54px]">
                    <div
                      className="animate-chart-grow w-full rounded-t-lg transition-[filter]"
                      style={{
                        // Final height from the first render: the reveal is a
                        // CSS transform on top, so a skipped animation frame
                        // leaves a correct static bar, never an empty one.
                        height: `${frac * (height - 34)}px`,
                        animationDelay: `${i * 60}ms`,
                        minHeight: d.value > 0 ? 4 : 0,
                        background: `linear-gradient(180deg, ${hue.from}, ${hue.to})`,
                        filter: isH ? "brightness(1.08)" : undefined,
                        boxShadow: isH ? `0 6px 18px ${hue.solid}55` : `0 2px 8px ${hue.solid}22`,
                      }}
                    />
                  </div>

                  {isH && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
                      <p className="font-semibold text-slate-700">{d.label}</p>
                      <p className="mt-0.5 flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: hue.solid }}
                        />
                        <span className="font-semibold tabular-nums text-slate-800">
                          {formatTooltip ? formatTooltip(d) : formatValue(d.value)}
                        </span>
                      </p>
                      {d.hint && <p className="mt-0.5 text-slate-400">{d.hint}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category axis, aligned to the same columns as the bars */}
      <div className="mt-1.5 flex gap-2">
        <div className="w-11 shrink-0" />
        <div className="flex min-w-0 flex-1 justify-around gap-1.5 sm:gap-3">
          {data.map((d, i) => (
            <span
              key={`${d.label}-${i}-l`}
              className={`min-w-0 flex-1 truncate text-center text-[11px] transition-colors ${
                hover === i ? "font-semibold text-slate-700" : "text-slate-400"
              }`}
              title={d.label}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
