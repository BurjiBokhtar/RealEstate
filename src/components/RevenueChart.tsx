"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";

export type RevenueMonth = { month: string; tjs: number; usd: number };

const PLOT = 190; // px height of the bar area

// Compact axis/label money: 5 720 000 -> "5,7 млн", 384 000 -> "384 т".
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} т`;
  return String(Math.round(n));
}

// TJS uses the fixed atlas-saffron gold -- a warm accent that reads as
// "money" and stays legible on white regardless of which dashboard theme is
// active (unlike --brand-strong, which on the emerald/ocean/sunset themes
// turns near-black and made the tallest bars look flat and heavy). USD uses
// the theme's own accent (the third hero-gradient stop -- mint/amber/sky
// depending on the theme), so the two currencies still read apart at a
// glance and the chart still answers to the chosen theme, just not with two
// competing dark hues.
const TJS_COLOR = "var(--atlas-saffron)";
const USD_COLOR = "var(--hero-3)";

function Bar({
  frac,
  color,
  delay,
  highlighted,
}: {
  frac: number;
  color: string;
  delay: number;
  highlighted: boolean;
}) {
  return (
    <div
      className={`w-full rounded-t-lg shadow-sm transition-[height,filter] duration-700 ease-out ${
        highlighted ? "brightness-110" : ""
      }`}
      style={{
        height: `${frac * 100}%`,
        minHeight: frac > 0 ? 5 : 0,
        transitionDelay: `${delay}ms`,
        background: color,
      }}
    />
  );
}

// A bold, space-filling grouped bar chart. Bars fill their columns (no thin
// sticks), each column labelled with its value, TJS and USD each on their own
// scale so both read clearly. Gridlines, hover spotlight and a tooltip round
// it out.
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TJS_COLOR }} /> TJS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: USD_COLOR }} /> USD
        </span>
      </div>

      <div className="relative" style={{ height: PLOT }}>
        {/* Dashed gridlines behind the bars. */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-slate-100" />
          ))}
        </div>

        <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2.5">
          {data.map((d, idx) => {
            const isH = hovered === d.month;
            const primary = d.tjs >= 1 ? compact(d.tjs) : d.usd >= 1 ? compact(d.usd) : "";
            return (
              <div
                key={d.month}
                className="group relative flex h-full flex-1 flex-col justify-end rounded-t-lg px-0.5 transition-colors hover:bg-slate-50"
                onMouseEnter={() => setHovered(d.month)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* value label above the column */}
                {primary && (
                  <span
                    className={`mb-1 text-center text-[10px] font-semibold tabular-nums transition-colors ${
                      isH ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {primary}
                  </span>
                )}
                <div className="flex h-full w-full items-end justify-center gap-1">
                  {anyTjs && (
                    <Bar
                      frac={mounted ? d.tjs / maxTjs : 0}
                      color={TJS_COLOR}
                      delay={idx * 55}
                      highlighted={isH}
                    />
                  )}
                  {anyUsd && (
                    <Bar
                      frac={mounted ? d.usd / maxUsd : 0}
                      color={USD_COLOR}
                      delay={idx * 55 + 25}
                      highlighted={isH}
                    />
                  )}
                </div>

                <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl group-hover:visible">
                  <p className="mb-1 font-semibold text-slate-700">{d.month}</p>
                  {d.tjs > 0 && (
                    <p className="flex items-center gap-1.5" style={{ color: TJS_COLOR }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: TJS_COLOR }} />
                      {formatCurrency(d.tjs, "TJS")}
                    </p>
                  )}
                  {d.usd > 0 && (
                    <p className="flex items-center gap-1.5" style={{ color: USD_COLOR }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: USD_COLOR }} />
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

      <div className="flex gap-1.5 sm:gap-2.5">
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
