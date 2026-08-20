import type { TaskStatusValue } from "./types";

export const TASK_STATUS_COLORS: Record<TaskStatusValue, string> = {
  todo: "bg-[var(--wash-slate)] text-[var(--wash-slate-ink)]",
  in_progress: "bg-[var(--wash-violet)] text-[var(--wash-violet-ink)]",
  done: "bg-[var(--wash-emerald)] text-[var(--wash-emerald-ink)]",
};
