"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { SetupNotice } from "@/components/SetupNotice";
import { ObjectForm } from "@/components/ObjectForm";
import { useRole } from "@/lib/auth/useRole";
import type { PropertyObject, PropertyObjectInput } from "@/lib/objects/types";

export default function ObjectDetailPage() {
  const { t } = useLocale();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role } = useRole();

  // Seeded from `configured` rather than set from inside the effect: the
  // flag is a build-time env check, constant for the whole session, so the
  // not-configured case is a starting value, not something to synchronise.
  const [object, setObject] = useState<PropertyObject | null | undefined>(
    configured ? undefined : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
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
        rooms: values.rooms ? Number(values.rooms) : null,
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
    if (!(await confirm(t.objects.form.confirmDelete, { danger: true }))) return;
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").from("objects").delete().eq("id", params.id);
    if (error) {
      setDeleteError(t.objects.form.deleteBlocked);
      return;
    }
    router.push("/objects");
  };

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/objects">{t.objects.backToList}</BackLink>

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
              rooms: object.rooms?.toString() ?? "",
              area: object.area?.toString() ?? "",
              price: object.price?.toString() ?? "",
              currency: object.currency,
              description: object.description ?? "",
              plan_url: object.plan_url ?? "",
            }}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={role === "admin" ? handleDelete : undefined}
            readOnly={role !== "admin"}
          />
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
        </>
      )}
    </div>
  );
}
