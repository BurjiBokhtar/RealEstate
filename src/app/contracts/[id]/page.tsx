"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractForm } from "@/components/ContractForm";
import type { Contract, ContractInput } from "@/lib/contracts/types";

export default function ContractDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [contract, setContract] = useState<Contract | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) {
      setContract(null);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select("*")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setContract((data as Contract) ?? null));
  }, [configured, params.id]);

  const handleSubmit = async (values: ContractInput) => {
    setSubmitting(true);
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("contracts")
      .update({
        number: values.number || null,
        client_id: values.client_id,
        object_id: values.object_id,
        amount: values.amount ? Number(values.amount) : 0,
        paid_amount: values.paid_amount ? Number(values.paid_amount) : 0,
        status: values.status,
        signed_date: values.signed_date || null,
        notes: values.notes || null,
      })
      .eq("id", params.id);
    setSubmitting(false);
    router.push("/contracts");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.contracts.form.confirmDelete)) return;
    const supabase = createClient();
    await supabase.schema("crm").from("contracts").delete().eq("id", params.id);
    router.push("/contracts");
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contracts" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.contracts.backToList}
      </Link>

      {!configured && <SetupNotice />}

      {configured && contract === undefined && (
        <p className="text-slate-400">{t.common.loading}</p>
      )}
      {configured && contract === null && (
        <p className="text-slate-400">{t.contracts.notFound}</p>
      )}

      {contract && (
        <>
          <h1 className="text-2xl font-semibold">
            {contract.number || t.contracts.newContract}
          </h1>
          <ContractForm
            initial={{
              number: contract.number ?? "",
              client_id: contract.client_id,
              object_id: contract.object_id,
              amount: contract.amount.toString(),
              paid_amount: contract.paid_amount.toString(),
              status: contract.status,
              signed_date: contract.signed_date ?? "",
              notes: contract.notes ?? "",
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
