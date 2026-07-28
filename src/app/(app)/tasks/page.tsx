"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { TASK_STATUS_COLORS } from "@/lib/tasks/format";
import { TASK_STATUSES, type Task, type TaskStatusValue } from "@/lib/tasks/types";

const PAGE_SIZE = 25;

export default function TasksPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | "all">("all");

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    let query = supabase.schema("crm").from("tasks").select("*", { count: "exact" });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const from = (page - 1) * PAGE_SIZE;
    query = query
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    query.then(({ data, count }) => {
      setTasks((data ?? []) as Task[]);
      setTotalCount(count ?? 0);
      setLoading(false);
    });
  }, [configured, page, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.tasks.title}</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
        >
          + {t.tasks.newTask}
        </Link>
      </div>

      {!configured && <SetupNotice />}

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatusValue | "all")}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="all">{t.tasks.filters.allStatuses}</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.tasks.statuses[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="animate-fade-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {t.tasks.empty}
                </td>
              </tr>
            )}
            {tasks.map((task) => {
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
                  className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
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

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
