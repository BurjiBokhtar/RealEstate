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
