"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatDualCurrency } from "@/lib/currency";
import { formatArea } from "@/lib/objects/format";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string; phone: string | null; email: string | null } | null;
  object: { name: string; address: string | null; area: number | null } | null;
};

export default function ContractPrintPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const params = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(
    undefined
  );
  const [payments, setPayments] = useState<ContractPayment[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select(
        "*, client:clients(name, phone, email), object:objects(name, address, area)"
      )
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setContract((data as unknown as ContractWithRelations) ?? null));
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("*")
      .eq("contract_id", params.id)
      .order("due_date", { ascending: true })
      .then(({ data }) => setPayments((data ?? []) as ContractPayment[]));
  }, [params.id]);

  if (contract === undefined) return <p className="text-slate-400">{t.common.loading}</p>;
  if (contract === null) return <p className="text-slate-400">{t.contracts.notFound}</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 bg-white p-8 print:p-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      <h1 className="text-center text-xl font-semibold text-slate-900">
        {t.contracts.print.title} {contract.number ? `№${contract.number}` : ""}
      </h1>
      <p className="text-center text-sm text-slate-500">
        {t.contracts.form.signedDate}: {contract.signed_date ?? "—"}
      </p>

      <section className="grid grid-cols-2 gap-6 border-y border-slate-200 py-4 text-sm">
        <div>
          <p className="font-semibold text-slate-700">{t.contracts.print.client}</p>
          <p>{contract.client?.name ?? "—"}</p>
          <p className="text-slate-500">{contract.client?.phone ?? ""}</p>
          <p className="text-slate-500">{contract.client?.email ?? ""}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">{t.contracts.print.object}</p>
          <p>{contract.object?.name ?? "—"}</p>
          <p className="text-slate-500">{contract.object?.address ?? ""}</p>
          <p className="text-slate-500">
            {t.contracts.print.area}: {formatArea(contract.object?.area ?? null)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <p>
          <span className="font-semibold text-slate-700">{t.contracts.form.amount}: </span>
          {formatDualCurrency(contract.amount, settings.usd_rate)}
        </p>
        <p>
          <span className="font-semibold text-slate-700">
            {t.contracts.form.paidAmount}:{" "}
          </span>
          {formatDualCurrency(contract.paid_amount, settings.usd_rate)}
        </p>
        <p>
          <span className="font-semibold text-slate-700">
            {t.contracts.form.paymentType}:{" "}
          </span>
          {t.contracts.paymentTypes[contract.payment_type]}
        </p>
        <p>
          <span className="font-semibold text-slate-700">{t.contracts.form.status}: </span>
          {t.contracts.statuses[contract.status]}
        </p>
      </section>

      {contract.payment_type === "barter" && contract.barter_details && (
        <section className="text-sm">
          <p className="font-semibold text-slate-700">{t.contracts.form.barterDetails}</p>
          <p>{contract.barter_details}</p>
        </section>
      )}

      {payments.length > 0 && (
        <section>
          <p className="mb-2 font-semibold text-slate-700">{t.contracts.payments.title}</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1">{t.contracts.payments.dueDate}</th>
                <th className="py-1">{t.contracts.payments.amount}</th>
                <th className="py-1">{t.contracts.payments.paid}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1">{p.due_date}</td>
                  <td className="py-1">{formatDualCurrency(p.amount, settings.usd_rate)}</td>
                  <td className="py-1">{p.paid ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {contract.notes && (
        <section className="text-sm">
          <p className="font-semibold text-slate-700">{t.contracts.form.notes}</p>
          <p>{contract.notes}</p>
        </section>
      )}

      <section className="mt-12 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-8 border-b border-slate-400 pb-1">{t.contracts.print.signature}</p>
          <p className="text-slate-500">{contract.client?.name ?? ""}</p>
        </div>
        <div>
          <p className="mb-8 border-b border-slate-400 pb-1">{t.contracts.print.signature}</p>
          <p className="text-slate-500">{t.contracts.print.date}: ______________</p>
        </div>
      </section>
    </div>
  );
}
