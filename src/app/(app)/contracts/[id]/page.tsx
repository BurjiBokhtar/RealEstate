"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractForm } from "@/components/ContractForm";
import { ContractPayments } from "@/components/ContractPayments";
import { SendActions } from "@/components/SendActions";
import type { Contract, ContractInput } from "@/lib/contracts/types";

export default function ContractDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();

  const [contract, setContract] = useState<Contract | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contracts")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    setContract((data as Contract) ?? null);
  }, [params.id]);

  useEffect(() => {
    if (!configured) {
      setContract(null);
      return;
    }
    loadContract();
  }, [configured, loadContract]);

  const handleSubmit = async (values: ContractInput) => {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .schema("crm")
      .from("contracts")
      .update({
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
      .eq("id", params.id);
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/contracts");
  };

  const handleDelete = async () => {
    if (!window.confirm(t.contracts.form.confirmDelete)) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .schema("crm")
      .from("contracts")
      .delete()
      .eq("id", params.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">
              {contract.number || t.contracts.newContract}
            </h1>
            <Link
              href={`/contracts/${params.id}/print`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.contracts.print.button}
            </Link>
          </div>
          <SendActions contractId={params.id} kind="contract" />
          <ContractForm
            initial={{
              number: contract.number ?? "",
              client_id: contract.client_id,
              object_id: contract.object_id,
              amount: contract.amount.toString(),
              paid_amount: contract.paid_amount.toString(),
              currency: contract.currency,
              amount_words: contract.amount_words ?? "",
              status: contract.status,
              signed_date: contract.signed_date ?? "",
              notes: contract.notes ?? "",
              payment_type: contract.payment_type,
              installment_months: contract.installment_months?.toString() ?? "",
              barter_details: contract.barter_details ?? "",
            }}
            submitting={submitting}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <ContractPayments contract={contract} onPaymentAdded={loadContract} />
        </>
      )}
    </div>
  );
}
