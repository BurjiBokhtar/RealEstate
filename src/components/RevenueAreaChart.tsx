"use client";

import { formatCurrency, type Currency } from "@/lib/currency";
import { AreaChart } from "@/components/charts/AreaChart";
import { CURRENCY_HUES, compactNumber } from "@/components/charts/palette";

export type RevenueMonth = { month: string; tjs: number; usd: number };

// Revenue over time, ONE PANEL PER CURRENCY, each on its own scale.
//
// Both currencies used to share a single axis, and that is why USD "didn't
// show": TJS runs in millions and USD in tens of thousands, so the USD line was
// pressed flat against the baseline and invisible even when the money was
// there. Two currencies are two different units -- putting them on one axis
// compares nothing, exactly as on the debtors page.
//
// A currency gets a panel when it has any money in the window; the label always
// says which currency the axis belongs to, so a single panel can never be
// mistaken for "the whole picture".
export function RevenueAreaChart({ data }: { data: RevenueMonth[] }) {
  const panels: Array<{ currency: Currency; values: number[] }> = [
    { currency: "TJS" as Currency, values: data.map((d) => d.tjs) },
    { currency: "USD" as Currency, values: data.map((d) => d.usd) },
  ].filter((p) => p.values.some((v) => v > 0));

  if (panels.length === 0) return null;

  const labels = data.map((d) => d.month);

  return (
    <div className={`grid gap-5 ${panels.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
      {panels.map((p) => {
        const hue = CURRENCY_HUES[p.currency];
        const last = p.values[p.values.length - 1] ?? 0;
        return (
          <div key={p.currency} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--ink-3)]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: hue.solid }}
                />
                {p.currency}
              </span>
              {/* The axis is compacted ("5,7 млн"), so the latest month is
                  spelled out in full -- a rounded axis label is for comparing,
                  not for reading a number off. */}
              <span className="text-[var(--ink-5)]">
                {labels[labels.length - 1]}:{" "}
                <span className="font-semibold text-[var(--ink-2)]">
                  {formatCurrency(last, p.currency)}
                </span>
              </span>
            </div>
            <AreaChart
              labels={labels}
              series={[
                {
                  key: p.currency,
                  label: p.currency,
                  color: hue.solid,
                  values: p.values,
                },
              ]}
              height={190}
              formatValue={compactNumber}
            />
          </div>
        );
      })}
    </div>
  );
}
