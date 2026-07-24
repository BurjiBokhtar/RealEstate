"use client";

import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { TaskForm } from "@/components/TaskForm";
import type { TaskInput } from "@/lib/tasks/types";

export default function NewTaskPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: TaskInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("tasks")
      .insert({
        title: values.title,
        description: values.description || null,
        due_date: values.due_date || null,
        status: values.status,
        assignee: values.assignee || null,
        assignee_phone: values.assignee_phone || null,
        client_id: values.client_id || null,
        object_id: values.object_id || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (!error && data) {
      router.push(`/tasks/${data.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/tasks">{t.tasks.backToList}</BackLink>
      <h1 className="text-2xl font-semibold">{t.tasks.newTask}</h1>
      {!configured && <SetupNotice />}
      <TaskForm submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
