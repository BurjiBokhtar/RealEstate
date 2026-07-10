"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ObjectForm } from "@/components/ObjectForm";
import type { PropertyObject, PropertyObjectInput } from "@/lib/objects/types";

export default function ObjectDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [object, setObject] = useState<PropertyObject | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) {
      setObject(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("objects")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setObject((data as PropertyObject) ?? null));
  }, [configured, params.id]);

  const handleSubmit = async (values: PropertyObjectInput) => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("objects")
      .update({
        name: values.name,
        address: values.address || null,
        type: values.type,
        status: values.status,
        area: values.area ? Number(values.area) : null,
        price: values.price ? Number(values.price) : null,
        currency: values.currency,
        description: values.description || null,
        plan_url: values.plan_url || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/objects");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.objects.form.confirmDelete)) return;
    const supabase = createClient();
    await supabase.schema("crm").from("objects").delete().eq("id", params.id);
    router.push("/objects");
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/objects" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.objects.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && object === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && object === null && (
        <p className="text-slate-400">{t.objects.notFound}</p>
      )}

      {object && (
        <>
          <h1 className="text-2xl font-semibold">{object.name}</h1>
          <ObjectForm
            initial={{
              name: object.name,
              address: object.address ?? "",
              type: object.type,
              status: object.status,
              area: object.area?.toString() ?? "",
              price: object.price?.toString() ?? "",
              currency: object.currency,
              description: object.description ?? "",
              plan_url: object.plan_url ?? "",
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
