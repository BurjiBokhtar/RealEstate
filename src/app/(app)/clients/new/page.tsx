"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ClientForm } from "@/components/ClientForm";
import type { ClientInput } from "@/lib/clients/types";

export default function NewClientPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: ClientInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("clients")
      .insert({
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        passport: values.passport || null,
        source: values.source || null,
        status: values.status,
        interested_object_id: values.interested_object_id || null,
        notes: values.notes || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (!error && data) {
      router.push(`/clients/${data.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/clients" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.clients.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.clients.newClient}</h1>
      {!configured && <SetupNotice />}
      <ClientForm submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
