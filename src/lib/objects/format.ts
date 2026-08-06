import type { ObjectStatus } from "./types";

// Built once -- this runs per cell of the shakhmatka; see the note in
// lib/currency.ts.
const areaFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function formatArea(area: number | null) {
  if (area === null) return "—";
  // Round to at most 2 decimals and group thousands, so a stored 55.2999999
  // reads "55.3 м²" instead of a long tail of digits.
  return `${areaFormat.format(area)} м²`;
}

export const STATUS_COLORS: Record<ObjectStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  sold: "bg-rose-100 text-rose-700",
  rented: "bg-sky-100 text-sky-700",
  in_progress: "bg-violet-100 text-violet-700",
};

// The payment bar drawn along the bottom of a shakhmatka cell, in that cell's
// OWN hue -- same colour, just stronger. A single green fill sitting on a rose
// "продано" cell read as a second, unrelated colour system laid over the
// status colours; this way the bar looks like more of the cell.
//
// Kept next to STATUS_COLORS on purpose: the two must move together, and a
// hue added to one and forgotten in the other is exactly how a status ends up
// with a bar that clashes with its own background.
export const STATUS_PROGRESS_COLORS: Record<ObjectStatus, { track: string; fill: string }> = {
  available: { track: "bg-emerald-200", fill: "bg-emerald-500" },
  reserved: { track: "bg-amber-200", fill: "bg-amber-500" },
  sold: { track: "bg-rose-200", fill: "bg-rose-500" },
  rented: { track: "bg-sky-200", fill: "bg-sky-500" },
  in_progress: { track: "bg-violet-200", fill: "bg-violet-500" },
};
