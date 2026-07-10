import type { LeadStatus } from "./types";

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-sky-100 text-sky-700",
  contacted: "bg-amber-100 text-amber-700",
  negotiation: "bg-violet-100 text-violet-700",
  client: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-200 text-slate-600",
};
