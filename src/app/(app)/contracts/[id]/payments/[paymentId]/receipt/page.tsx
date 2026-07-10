"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
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
  }, [params.id, params.paymentId]);

  if (contract === undefined || payment === undefined) {
    return <p className="text-slate-400">{t.common.loading}</p>;
  }
  if (contract === null || payment === null) {
    return <p className="text-slate-400">{t.contracts.notFound}</p>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 bg-white p-8 print:p-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      <div className="flex flex-col items-center gap-2 border-b border-slate-200 pb-4 text-center">
        {settings.company_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.company_logo_url} alt="" className="h-12 w-12 object-contain" />
        )}
        <p className="font-semibold text-slate-900">{settings.company_name || t.appName}</p>
        <p className="text-lg font-semibold text-slate-900">{t.contracts.receipt.title}</p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
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

      <div className="rounded-lg bg-slate-50 p-4 text-center">
        <p className="text-xs text-slate-500">{t.contracts.receipt.amountPaid}</p>
        <p className="text-2xl font-semibold text-slate-900">
          {formatCurrency(payment.amount, contract.currency)}
        </p>
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>{t.contracts.form.amount}</span>
        <span>{formatCurrency(contract.amount, contract.currency)}</span>
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{t.contracts.form.paidAmount}</span>
        <span>{formatCurrency(contract.paid_amount, contract.currency)}</span>
      </div>

      <p className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        {payment.paid ? t.contracts.receipt.statusPaid : t.contracts.receipt.statusUnpaid}
      </p>
    </div>
  );
}
