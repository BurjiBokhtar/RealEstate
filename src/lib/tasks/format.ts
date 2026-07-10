import type { TaskStatusValue } from "./types";

export const TASK_STATUS_COLORS: Record<TaskStatusValue, string> = {
  todo: "bg-slate-200 text-slate-600",
  in_progress: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
};
