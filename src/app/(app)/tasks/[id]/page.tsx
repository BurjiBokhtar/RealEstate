"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { SetupNotice } from "@/components/SetupNotice";
import { TaskForm } from "@/components/TaskForm";
import type { Task, TaskInput } from "@/lib/tasks/types";

export default function TaskDetailPage() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  // Seeded from `configured` rather than set from inside the effect: the
  // flag is a build-time env check, constant for the whole session, so the
  // not-configured case is a starting value, not something to synchronise.
  const [task, setTask] = useState<Task | null | undefined>(
    configured ? undefined : null
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("tasks")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setTask((data as Task) ?? null));
  }, [configured, params.id]);

  const handleSubmit = async (values: TaskInput) => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("tasks")
      .update({
        title: values.title,
        description: values.description || null,
        due_date: values.due_date || null,
        status: values.status,
        assignee: values.assignee || null,
        assignee_phone: values.assignee_phone || null,
        client_id: values.client_id || null,
        object_id: values.object_id || null,
        reminder_sent_at: null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/tasks");
  };

  const handleDelete = async () => {
    if (!(await confirm(t.tasks.form.confirmDelete, { danger: true }))) return;
    const supabase = createClient();
    await supabase.schema("crm").from("tasks").delete().eq("id", params.id);
    router.push("/tasks");
  };

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/tasks">{t.tasks.backToList}</BackLink>

      {!configured && <SetupNotice />}

      {configured && task === undefined && (
        <p className="text-[var(--ink-5)]">{t.common.loading}</p>
      )}
      {configured && task === null && <p className="text-[var(--ink-5)]">{t.tasks.notFound}</p>}

      {task && (
        <>
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          <TaskForm
            initial={{
              title: task.title,
              description: task.description ?? "",
              due_date: task.due_date ?? "",
              status: task.status,
              assignee: task.assignee ?? "",
              assignee_phone: task.assignee_phone ?? "",
              client_id: task.client_id ?? "",
              object_id: task.object_id ?? "",
            }}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  );
}
