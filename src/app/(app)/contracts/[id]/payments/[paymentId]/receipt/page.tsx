"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Settings } from "@/lib/settings/types";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string } | null;
  object: { name: string } | null;
};

// One receipt, printed as two identical copies stacked on the same sheet --
// standard practice at the front desk: tear along the dashed line, hand the
// top half to the client, keep the bottom half for the company's own
// records. Each copy is labeled so it's unambiguous which is which once
// they're separated.
function ReceiptCopy({
  t,
  settings,
  contract,
  payment,
  receiptNo,
  remaining,
  copyLabel,
}: {
  t: Dictionary;
  settings: Settings;
  contract: ContractWithRelations;
  payment: ContractPayment;
  receiptNo: number | null;
  remaining: number;
  copyLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:shadow-none">
      <p className="bg-slate-50 px-6 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400 print:bg-transparent">
        {copyLabel}
      </p>
      {/* Header band — dark text on white rather than white-on-dark, so it
          still reads correctly when "background graphics" is off in the
          print dialog (the default in most browsers). */}
      <div className="flex flex-col items-center gap-2 border-b-4 border-slate-900 px-6 py-6 text-center">
        {settings.company_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.company_logo_url}
            alt=""
            className="h-12 w-12 rounded-lg border border-slate-200 object-contain p-1"
          />
        )}
        <p className="text-sm font-medium text-slate-500">{settings.company_name || t.appName}</p>
        <p className="text-lg font-semibold tracking-tight text-slate-900">
          {t.contracts.receipt.title}
          {receiptNo ? ` №${receiptNo}` : ""}
        </p>
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-medium ${
            payment.paid
              ? "border-emerald-300 text-emerald-700"
              : "border-amber-300 text-amber-700"
          }`}
        >
          {payment.paid ? t.contracts.receipt.statusPaid : t.contracts.receipt.statusUnpaid}
        </span>
      </div>

      {/* Amount */}
      <div className="flex flex-col items-center gap-1 border-b border-dashed border-slate-200 px-6 py-5 text-center">
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

      {/* Signature line -- a torn-off copy is only useful as proof if
          someone actually signed it. */}
      <div className="flex items-center justify-between px-6 py-4 text-xs text-slate-400">
        <span>{settings.company_name || t.appName}</span>
        <span className="border-b border-slate-300 pb-0.5 pl-8">{t.contracts.print.signature}</span>
      </div>
      <div className="border-t-4 border-slate-900" />
    </div>
  );
}

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
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-6 print:max-w-none print:py-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      {/* Both copies share one A4 sheet, so each gets exactly half its
          printable height (297mm - the @page top/bottom margins) rather
          than however tall its own content happens to be -- otherwise a
          short receipt leaves the second copy nowhere near the fold, or a
          slightly taller one pushes it onto a second page. */}
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 print:h-[273mm] print:max-w-none print:gap-0">
        <div className="print:flex print:h-1/2 print:flex-col print:justify-center print:overflow-hidden">
          <ReceiptCopy
            t={t}
            settings={settings}
            contract={contract}
            payment={payment}
            receiptNo={receiptNo}
            remaining={remaining}
            copyLabel={t.contracts.receipt.copyForClient}
          />
        </div>

        <div
          aria-hidden="true"
          className="flex items-center gap-2 text-slate-300 print:text-slate-400"
        >
          <span className="flex-1 border-t border-dashed border-current" />
          <span className="text-xs">✂ {t.contracts.receipt.cutHere}</span>
          <span className="flex-1 border-t border-dashed border-current" />
        </div>

        <div className="print:flex print:h-1/2 print:flex-col print:justify-center print:overflow-hidden">
          <ReceiptCopy
            t={t}
            settings={settings}
            contract={contract}
            payment={payment}
            receiptNo={receiptNo}
            remaining={remaining}
            copyLabel={t.contracts.receipt.copyForCompany}
          />
        </div>
      </div>
    </div>
  );
}
