import type { ContractStatus } from "./types";

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: "bg-slate-200 text-slate-600",
  active: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};
