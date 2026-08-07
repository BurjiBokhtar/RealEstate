"use client";

import { formatCurrency } from "@/lib/currency";
import { AreaChart } from "@/components/charts/AreaChart";
import { CURRENCY_HUES, compactNumber } from "@/components/charts/palette";

export type RevenueMonth = { month: string; tjs: number; usd: number };

// Revenue over time, as a line with a gradient area under it rather than the
// grouped bars this used to be. A trend is a shape, and a filled line shows
// the shape; paired bars made the reader re-derive it column by column.
//
// The two currencies keep the theme colours (--brand and its light accent) so
// the chart still answers to whichever theme the company picked.
export function RevenueAreaChart({ data }: { data: RevenueMonth[] }) {
  const anyTjs = data.some((d) => d.tjs > 0);
  const anyUsd = data.some((d) => d.usd > 0);

  const series = [
    anyTjs
      ? {
          key: "tjs",
          label: "TJS",
          color: CURRENCY_HUES.TJS,
          values: data.map((d) => d.tjs),
        }
      : null,
    anyUsd
      ? {
          key: "usd",
          label: "USD",
          color: CURRENCY_HUES.USD,
          values: data.map((d) => d.usd),
        }
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <AreaChart
        labels={data.map((d) => d.month)}
        series={series}
        formatValue={compactNumber}
      />
      {/* The axis is compacted ("5,7 млн"), so the exact latest figure is
          spelled out underneath -- a rounded axis label is for comparing, not
          for reading a number off. */}
      {data.length > 0 && (
        <p className="text-xs text-slate-400">
          {data[data.length - 1].month}:{" "}
          {[
            data[data.length - 1].tjs > 0
              ? formatCurrency(data[data.length - 1].tjs, "TJS")
              : null,
            data[data.length - 1].usd > 0
              ? formatCurrency(data[data.length - 1].usd, "USD")
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      )}
    </div>
  );
}
