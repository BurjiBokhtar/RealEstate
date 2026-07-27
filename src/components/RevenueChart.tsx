"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";

export type RevenueMonth = { month: string; tjs: number; usd: number };

const PLOT = 150; // px height of the bar area

// A single value bar: gradient fill, rounded top, grows from the baseline on
// mount with a small per-bar delay for a lively staggered reveal.
function Bar({
  frac,
  gradient,
  delay,
  highlighted,
}: {
  frac: number;
  gradient: string;
  delay: number;
  highlighted: boolean;
}) {
  return (
    <div
      className={`w-full max-w-[16px] rounded-t-md bg-gradient-to-t ${gradient} transition-[height,filter] duration-700 ease-out ${
        highlighted ? "brightness-110 saturate-150" : ""
      }`}
      style={{
        height: `${frac * 100}%`,
        minHeight: frac > 0 ? 4 : 0,
        transitionDelay: `${delay}ms`,
      }}
    />
  );
}

// A modern grouped bar chart. TJS and USD live on independent scales (millions
// vs thousands would otherwise flatten USD to nothing), each normalised to its
// own peak, so both series are actually readable. Dashed gridlines, a hover
// spotlight and a rich tooltip make it a real chart, not a row of blue sticks.
export function RevenueChart({ data }: { data: RevenueMonth[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const maxTjs = Math.max(...data.map((d) => d.tjs), 1);
  const maxUsd = Math.max(...data.map((d) => d.usd), 1);
  const anyTjs = data.some((d) => d.tjs > 0);
  const anyUsd = data.some((d) => d.usd > 0);

  const peakTjs = data.reduce((a, b) => (b.tjs > a.tjs ? b : a), data[0]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-t from-sky-500 to-sky-400" /> TJS
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400" />{" "}
            USD
          </span>
        </div>
        {anyTjs && peakTjs && (
          <span className="text-[11px] text-slate-400">
            пик · {formatCurrency(peakTjs.tjs, "TJS")}
          </span>
        )}
      </div>

      <div className="relative" style={{ height: PLOT }}>
        {/* Dashed gridlines behind the bars. */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-dashed border-slate-100" />
          ))}
        </div>

        {/* Bars. */}
        <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
          {data.map((d, idx) => {
            const isH = hovered === d.month;
            return (
              <div
                key={d.month}
                className="group relative flex h-full flex-1 items-end justify-center rounded-t-md transition-colors hover:bg-slate-50/70"
                onMouseEnter={() => setHovered(d.month)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex h-full w-full items-end justify-center gap-1.5">
                  {anyTjs && (
                    <Bar
                      frac={mounted ? d.tjs / maxTjs : 0}
                      gradient="from-sky-500 to-sky-400"
                      delay={idx * 60}
                      highlighted={isH}
                    />
                  )}
                  {anyUsd && (
                    <Bar
                      frac={mounted ? d.usd / maxUsd : 0}
                      gradient="from-violet-500 to-fuchsia-400"
                      delay={idx * 60 + 30}
                      highlighted={isH}
                    />
                  )}
                </div>

                {/* Tooltip */}
                <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl group-hover:visible">
                  <p className="mb-1 font-semibold text-slate-700">{d.month}</p>
                  {d.tjs > 0 && (
                    <p className="flex items-center gap-1.5 text-sky-600">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      {formatCurrency(d.tjs, "TJS")}
                    </p>
                  )}
                  {d.usd > 0 && (
                    <p className="flex items-center gap-1.5 text-violet-600">
                      <span className="h-2 w-2 rounded-full bg-violet-500" />
                      {formatCurrency(d.usd, "USD")}
                    </p>
                  )}
                  {d.tjs === 0 && d.usd === 0 && <p className="text-slate-400">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month labels */}
      <div className="flex gap-2 sm:gap-3">
        {data.map((d) => (
          <span
            key={d.month}
            className={`flex-1 text-center text-[10px] transition-colors ${
              hovered === d.month ? "font-semibold text-slate-700" : "text-slate-400"
            }`}
          >
            {d.month}
          </span>
        ))}
      </div>
    </div>
  );
}
