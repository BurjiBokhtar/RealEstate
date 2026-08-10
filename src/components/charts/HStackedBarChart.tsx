"use client";

import { useState } from "react";
import type { ChartHue } from "./palette";

export type StackSeries = { key: string; label: string; hue: ChartHue };
export type StackRow = { label: string; values: Record<string, number> };

// Occupancy as one horizontal bar per building, each drawn to 100% of its own
// total, sorted by how much of it is gone.
//
// It replaces vertical columns, which stopped working as the company grew:
// with the columns sharing the card's width, every new building made all of
// them thinner. Past about fourteen a column was 20px wide and its name -- a
// real one reads "Кайҳонавардон 36 «В»" -- had nowhere to go, so the labels
// truncated, then vanished entirely, leaving coloured threads nobody could
// match to a building.
//
// Turned on its side the width belongs to the bar and the height to the list,
// so the name has the full left column at any count and nothing ever
// truncates. Sorting by the share sold turns it into a ranking: what is nearly
// gone at the top, what still has stock at the bottom -- which is the order
// somebody looking at this actually wants.

export function HStackedBarChart({
  series,
  rows,
  /** Series whose share sorts the list, and whose percentage is the headline. */
  sortBy,
}: {
  series: StackSeries[];
  rows: StackRow[];
  sortBy: string;
}) {
  // Which building the pointer is on, and which STATUS within it. Pointing at
  // a colour should tell you about that colour, so the segment under the
  // cursor stays lit and the rest of the chart steps back.
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const withTotals = rows.map((row) => {
    const total = series.reduce((s, se) => s + (row.values[se.key] ?? 0), 0);
    return { row, total, share: total > 0 ? (row.values[sortBy] ?? 0) / total : 0 };
  });
  const sorted = [...withTotals].sort((a, b) => b.share - a.share || b.total - a.total);

  return (
    <ul className="flex flex-col gap-1">
      {sorted.map(({ row, total, share }) => {
        const isRowHot = hoverRow === row.label;
        const rowDim = hoverRow !== null && !isRowHot;
        return (
          <li
            key={row.label}
            onMouseEnter={() => setHoverRow(row.label)}
            onMouseLeave={() => {
              setHoverRow(null);
              setHoverKey(null);
            }}
            className="relative flex items-center gap-3 rounded-lg px-1.5 py-1 transition-[background-color,opacity] duration-200"
            style={{
              opacity: rowDim ? 0.45 : 1,
              backgroundColor: isRowHot ? "rgb(248 250 252)" : undefined,
            }}
          >
            <span
              className={`w-28 shrink-0 truncate text-[11px] transition-colors sm:w-36 ${
                isRowHot ? "font-semibold text-slate-700" : "text-slate-500"
              }`}
              title={row.label}
            >
              {row.label}
            </span>

            <span className="relative flex h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              {/* One growth animation on the whole track, not per segment:
                  segments animating independently would slide past each other
                  as the bar assembled. */}
              <span className="animate-chart-grow-x flex h-full w-full">
                {series.map((se) => {
                  const v = row.values[se.key] ?? 0;
                  if (!v || !total) return null;
                  const pct = (v / total) * 100;
                  const segHot = hoverKey === se.key;
                  const segDim = hoverKey !== null && !segHot;
                  return (
                    <span
                      key={se.key}
                      onMouseEnter={() => setHoverKey(se.key)}
                      className="h-full transition-[filter,opacity] duration-200"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(180deg, ${se.hue.from}, ${se.hue.to})`,
                        filter: segHot ? "brightness(1.1)" : undefined,
                        opacity: segDim ? 0.3 : 1,
                        // A hairline of card between segments so two adjacent
                        // colours read as two, not as one gradient.
                        boxShadow: "inset -1px 0 0 rgb(255 255 255 / 0.75)",
                      }}
                    />
                  );
                })}
              </span>
            </span>

            {/* The share sold, which is what "occupancy" means, with the
                absolute count under it so size information isn't lost. */}
            <span className="flex w-14 shrink-0 flex-col items-end leading-none">
              <span
                className={`text-xs font-semibold tabular-nums transition-colors ${
                  isRowHot ? "text-slate-900" : "text-slate-600"
                }`}
              >
                {Math.round(share * 100)}%
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-slate-400">{total}</span>
            </span>

            {isRowHot && (
              <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
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
                        {/* Separated by a dot, not just a gap: "30" beside
                            "63%" reads as one number ("3063%") the moment the
                            two are set close enough to look like one column. */}
                        <span className="ml-auto pl-4 font-semibold tabular-nums text-slate-800">
                          {row.values[se.key]}
                          <span className="ml-1.5 font-normal text-slate-400">
                            · {Math.round(((row.values[se.key] ?? 0) / total) * 100)}%
                          </span>
                        </span>
                      </p>
                    );
                  })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
