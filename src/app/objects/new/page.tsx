"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ObjectForm } from "@/components/ObjectForm";
import type { PropertyObjectInput } from "@/lib/objects/types";

export default function NewObjectPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: PropertyObjectInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("objects")
      .insert({
        name: values.name,
        address: values.address || null,
        type: values.type,
        status: values.status,
        area: values.area ? Number(values.area) : null,
        price: values.price ? Number(values.price) : null,
        description: values.description || null,
        plan_url: values.plan_url || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (!error && data) {
      router.push(`/objects/${data.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/objects" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.objects.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.objects.newObject}</h1>
      {!configured && <SetupNotice />}
      <ObjectForm submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
