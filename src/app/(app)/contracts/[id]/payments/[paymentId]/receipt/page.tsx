"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string } | null;
  object: { name: string } | null;
};

export default function PaymentReceiptPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const params = useParams<{ id: string; paymentId: string }>();
  const [contract, setContract] = useState<ContractWithRelations | null | undefined>(
    undefined
  );
  const [payment, setPayment] = useState<ContractPayment | null | undefined>(undefined);
  const [receiptNo, setReceiptNo] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contracts")
      .select("*, client:clients(name), object:objects(name)")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data }) => setContract((data as unknown as ContractWithRelations) ?? null));
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("*")
      .eq("id", params.paymentId)
      .maybeSingle()
      .then(({ data }) => setPayment((data as ContractPayment) ?? null));
    supabase
      .schema("crm")
      .from("contract_payments")
      .select("id, due_date")
      .eq("contract_id", params.id)
      .then(({ data }) =>
        setReceiptNo(receiptNumberFor((data ?? []) as ContractPayment[], params.paymentId))
      );
  }, [params.id, params.paymentId]);

  if (contract === undefined || payment === undefined) {
    return <p className="text-slate-400">{t.common.loading}</p>;
  }
  if (contract === null || payment === null) {
    return <p className="text-slate-400">{t.contracts.notFound}</p>;
  }

  const remaining = contract.amount - contract.paid_amount;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-6 print:py-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Header band */}
        <div className="relative flex flex-col items-center gap-2 bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-7 text-center text-white print:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-12 w-12 rounded-lg bg-white object-contain p-1"
            />
          )}
          <p className="text-sm font-medium text-slate-200">
            {settings.company_name || t.appName}
          </p>
          <p className="text-lg font-semibold tracking-tight">
            {t.contracts.receipt.title}
            {receiptNo ? ` №${receiptNo}` : ""}
          </p>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-medium ${
              payment.paid
                ? "bg-emerald-400/20 text-emerald-300"
                : "bg-amber-400/20 text-amber-300"
            }`}
          >
            {payment.paid ? t.contracts.receipt.statusPaid : t.contracts.receipt.statusUnpaid}
          </span>
        </div>

        {/* Amount */}
        <div className="flex flex-col items-center gap-1 border-b border-dashed border-slate-200 px-6 py-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {t.contracts.receipt.amountPaid}
          </p>
          <p className="text-4xl font-bold text-slate-900">
            {formatCurrency(payment.amount, contract.currency)}
          </p>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2.5 px-6 py-5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{t.contracts.form.number}</span>
            <span className="font-medium text-slate-900">{contract.number || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t.contracts.print.client}</span>
            <span className="font-medium text-slate-900">{contract.client?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t.contracts.print.object}</span>
            <span className="font-medium text-slate-900">{contract.object?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t.contracts.payments.dueDate}</span>
            <span className="font-medium text-slate-900">{payment.due_date}</span>
          </div>
          {payment.paid_date && (
            <div className="flex justify-between">
              <span className="text-slate-500">{t.contracts.receipt.paidDate}</span>
              <span className="font-medium text-slate-900">{payment.paid_date}</span>
            </div>
          )}
        </div>

        {/* Contract totals */}
        <div className="grid grid-cols-2 gap-px border-t border-dashed border-slate-200 bg-slate-100 text-center">
          <div className="bg-slate-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {t.contracts.form.paidAmount}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-600">
              {formatCurrency(contract.paid_amount, contract.currency)}
            </p>
          </div>
          <div className="bg-slate-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {t.buildings.hover.remaining}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-amber-600">
              {formatCurrency(remaining, contract.currency)}
            </p>
          </div>
        </div>

        <p className="px-6 py-4 text-center text-xs text-slate-400">
          {settings.company_name || t.appName}
        </p>
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
      </div>
    </div>
  );
}
