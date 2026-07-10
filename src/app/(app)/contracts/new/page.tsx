"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractForm } from "@/components/ContractForm";
import type { ContractInput } from "@/lib/contracts/types";

export default function NewContractPage() {
  const { t } = useLocale();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: ContractInput) => {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("contracts")
      .insert({
        number: values.number || null,
        client_id: values.client_id,
        object_id: values.object_id,
        amount: values.amount ? Number(values.amount) : 0,
        paid_amount: values.paid_amount ? Number(values.paid_amount) : 0,
        currency: values.currency,
        amount_words: values.amount_words || null,
        status: values.status,
        signed_date: values.signed_date || null,
        notes: values.notes || null,
        payment_type: values.payment_type,
        installment_months: values.installment_months
          ? Number(values.installment_months)
          : null,
        barter_details: values.barter_details || null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (!error && data) {
      router.push(`/contracts/${data.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contracts" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        ← {t.contracts.backToList}
      </Link>
      <h1 className="text-2xl font-semibold">{t.contracts.newContract}</h1>
      {!configured && <SetupNotice />}
      <ContractForm submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
