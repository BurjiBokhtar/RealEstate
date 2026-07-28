"use client";

import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { ContractForm } from "@/components/ContractForm";
import { ContractPayments } from "@/components/ContractPayments";
import { ContractTabs } from "@/components/ContractTabs";
import { SendActions } from "@/components/SendActions";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency } from "@/lib/currency";
import { CONTRACT_STATUS_COLORS } from "@/lib/contracts/format";
import type { Contract, ContractInput } from "@/lib/contracts/types";

type ContractWithNames = Contract & {
  client: { name: string } | null;
  object: { name: string } | null;
};

export default function ContractDetailPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const { role } = useRole();

  const [contract, setContract] = useState<ContractWithNames | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients(name), object:objects(name)")
      .eq("id", params.id)
      .maybeSingle();
    setContract((data as unknown as ContractWithNames) ?? null);
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
    // Stay here in view mode with fresh data -- editing is the exception
    // on this page, not the default state.
    setEditing(false);
    await loadContract();
  };

  const handleDelete = async () => {
    if (!window.confirm(t.contracts.form.confirmDelete)) return;
    setError(null);
    const supabase = createClient();
    const clientId = contract?.client_id;
    const { error: deleteError } = await supabase
      .schema("crm")
      .from("contracts")
      .delete()
      .eq("id", params.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.push(clientId ? `/clients/${clientId}` : "/clients");
  };

  const summary: Array<{ label: string; value: React.ReactNode }> = contract
    ? [
        { label: t.contracts.form.client, value: contract.client?.name ?? "—" },
        { label: t.contracts.form.object, value: contract.object?.name ?? "—" },
        {
          label: t.contracts.form.amount,
          value: (
            <span className="font-semibold">
              {formatCurrency(contract.amount, contract.currency)}
            </span>
          ),
        },
        {
          label: t.contracts.form.paidAmount,
          value: (
            <span className="font-semibold text-emerald-600">
              {formatCurrency(contract.paid_amount, contract.currency)}
            </span>
          ),
        },
        {
          label: t.buildings.hover.remaining,
          value: (
            <span className="font-semibold text-rose-600">
              {formatCurrency(
                Math.max(contract.amount - contract.paid_amount, 0),
                contract.currency
              )}
            </span>
          ),
        },
        {
          label: t.contracts.form.paymentType,
          value:
            t.contracts.paymentTypes[contract.payment_type] +
            (contract.payment_type === "installment" && contract.installment_months
              ? ` · ${contract.installment_months} ${t.contracts.form.monthsShort}`
              : ""),
        },
        { label: t.contracts.form.signedDate, value: contract.signed_date ?? "—" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {contract?.client_id ? (
        <Link
          href={`/clients/${contract.client_id}`}
          className="w-fit text-sm text-slate-500 hover:text-slate-900"
        >
          ← {t.contracts.backToClient}
        </Link>
      ) : (
        <BackLink href="/clients">{t.clients.backToList}</BackLink>
      )}

      {contract && <ContractTabs id={params.id} active="overview" />}

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {contract.number || t.contracts.newContract}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}
              >
                {t.contracts.statuses[contract.status]}
              </span>
            </div>
            <Link
              href={`/contracts/${params.id}/print`}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              🖨 {t.contracts.print.button}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">
                  {t.contracts.detailsTitle}
                </p>
                {role !== "director" && (
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
                  >
                    {editing ? t.clients.profile.hideForm : t.clients.profile.edit}
                  </button>
                )}
              </div>

              {!editing && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {summary.map((f) => (
                    <div key={f.label} className="flex flex-col gap-0.5">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        {f.label}
                      </span>
                      <span className="text-sm text-slate-800">{f.value}</span>
                    </div>
                  ))}
                  {contract.notes && (
                    <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-3">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        {t.contracts.form.notes}
                      </span>
                      <span className="text-sm text-slate-800">{contract.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {editing && (
                <>
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
                    onDelete={role === "admin" ? handleDelete : undefined}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </>
              )}
            </div>

            <div className="flex flex-col gap-5 xl:sticky xl:top-5">
              <SendActions contractId={params.id} kind="contract" />
              <ContractPayments contract={contract} onPaymentAdded={loadContract} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
