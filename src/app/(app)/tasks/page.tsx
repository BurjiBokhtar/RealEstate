"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { TASK_STATUS_COLORS } from "@/lib/tasks/format";
import { TASK_STATUSES, type Task, type TaskStatusValue } from "@/lib/tasks/types";

export default function TasksPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | "all">("all");

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setTasks((data ?? []) as Task[]);
        setLoading(false);
      });
  }, [configured]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => statusFilter === "all" || task.status === statusFilter);
  }, [tasks, statusFilter]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.tasks.title}</h1>
        <Link
          href="/tasks/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + {t.tasks.newTask}
        </Link>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatusValue | "all")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">{t.tasks.filters.allStatuses}</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.tasks.statuses[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.tasks.table.title}</th>
              <th className="px-4 py-3 font-medium">{t.tasks.table.dueDate}</th>
              <th className="px-4 py-3 font-medium">{t.tasks.table.status}</th>
              <th className="px-4 py-3 font-medium">{t.tasks.table.assignee}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.tasks.empty}
                </td>
              </tr>
            )}
            {filtered.map((task) => {
              const today = new Date().toISOString().slice(0, 10);
              const soonDate = new Date();
              soonDate.setDate(soonDate.getDate() + 3);
              const soon = soonDate.toISOString().slice(0, 10);
              const overdue =
                task.status !== "done" && !!task.due_date && task.due_date < today;
              const dueSoon =
                task.status !== "done" &&
                !!task.due_date &&
                task.due_date >= today &&
                task.due_date <= soon;

              return (
                <tr
                  key={task.id}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/tasks/${task.id}`} className="block">
                      {task.title}
                    </Link>
                  </td>
                  <td
                    className={`px-4 py-3 ${overdue ? "font-medium text-rose-600" : dueSoon ? "font-medium text-amber-600" : "text-slate-600"}`}
                  >
                    {task.due_date || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${TASK_STATUS_COLORS[task.status]}`}
                    >
                      {t.tasks.statuses[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task.assignee || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
