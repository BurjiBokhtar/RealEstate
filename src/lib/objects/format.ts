import type { ObjectStatus } from "./types";

export function formatArea(area: number | null) {
  if (area === null) return "—";
  return `${area} м²`;
}

export const STATUS_COLORS: Record<ObjectStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  reserved: "bg-amber-100 text-amber-700",
  sold: "bg-rose-100 text-rose-700",
  rented: "bg-sky-100 text-sky-700",
  in_progress: "bg-violet-100 text-violet-700",
};
