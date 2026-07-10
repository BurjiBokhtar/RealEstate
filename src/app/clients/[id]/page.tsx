"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ClientForm } from "@/components/ClientForm";
import type { Client, ClientInput } from "@/lib/clients/types";

export default function ClientDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) {
      setClient(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("clients")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setClient((data as Client) ?? null));
  }, [configured, params.id]);

  const handleSubmit = async (values: ClientInput) => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("clients")
      .update({
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        source: values.source || null,
        status: values.status,
        interested_object_id: values.interested_object_id || null,
        notes: values.notes || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/clients");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.clients.form.confirmDelete)) return;
    const supabase = createClient();
    await supabase.schema("crm").from("clients").delete().eq("id", params.id);
    router.push("/clients");
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/clients" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.clients.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && client === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && client === null && (
        <p className="text-slate-400">{t.clients.notFound}</p>
      )}

      {client && (
        <>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <ClientForm
            initial={{
              name: client.name,
              phone: client.phone ?? "",
              email: client.email ?? "",
              source: client.source ?? "",
              status: client.status,
              interested_object_id: client.interested_object_id ?? "",
              notes: client.notes ?? "",
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
