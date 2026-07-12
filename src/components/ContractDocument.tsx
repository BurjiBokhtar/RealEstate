"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency, type Currency } from "@/lib/currency";
import { renderContractTemplate } from "@/lib/contracts/renderTemplate";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contracts/defaultTemplate";
import type { ContractPayment } from "@/lib/contracts/types";

export type ContractDocumentData = {
  number: string | null;
  signed_date: string | null;
  amount: number;
  paid_amount: number;
  amount_words: string | null;
  currency: Currency;
  client: {
    name: string;
    phone: string | null;
    passport: string | null;
    passport_issued_by: string | null;
    birth_date: string | null;
    address: string | null;
  } | null;
  object: {
    name: string;
    address: string | null;
    area: number | null;
    building: { address: string | null; price_per_sqm: number | null } | null;
  } | null;
};

// The printable contract letterhead — shared by the standalone print page
// and the in-modal preview shown right after booking, so both produce
// byte-for-byte the same document. Each caller wraps a pair of these (one
// per copyLabel) in its own #contract-print-area element for the print CSS
// in globals.css to scope to; this component no longer owns that id itself
// so two copies on the same page don't end up with a duplicate id.
export function ContractDocument({
  contract,
  payments,
  copyLabel,
}: {
  contract: ContractDocumentData;
  payments: ContractPayment[];
  copyLabel?: string;
}) {
  const { t } = useLocale();
  const { settings } = useSettings();

  const renderedText = renderContractTemplate(DEFAULT_CONTRACT_TEMPLATE, {
    contract_number: contract.number ?? "",
    signed_date: contract.signed_date ?? "",
    client_name: contract.client?.name ?? "",
    client_passport: contract.client?.passport ?? "",
    client_passport_issued_by: contract.client?.passport_issued_by ?? "",
    client_birth_date: contract.client?.birth_date ?? "",
    client_address: contract.client?.address ?? "",
    client_phone: contract.client?.phone ?? "",
    object_name: contract.object?.name ?? "",
    object_area: contract.object?.area?.toString() ?? "",
    building_address: contract.object?.building?.address ?? contract.object?.address ?? "",
    price_per_sqm: contract.object?.building?.price_per_sqm?.toString() ?? "",
    amount: new Intl.NumberFormat("ru-RU").format(contract.amount),
    amount_words: contract.amount_words ?? "",
    currency: contract.currency,
    company_name: settings.company_name ?? "",
    company_director: settings.company_director ?? "",
    company_address: settings.company_address ?? "",
    company_bank_details: settings.company_bank_details ?? "",
  });

  const remaining = contract.amount - contract.paid_amount;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none"
    >
      {copyLabel && (
        <p className="bg-slate-50 px-6 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400 print:bg-transparent">
          {copyLabel}
        </p>
      )}
      {/* Letterhead — dark text on white rather than white-on-dark, so it
          still reads correctly when "background graphics" is off in the
          print dialog (the default in most browsers), instead of printing
          as invisible white text on a blank page. */}
      <div className="flex items-center justify-between gap-4 border-b-4 border-slate-900 px-8 py-6">
        <div className="flex items-center gap-3">
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-14 w-14 rounded-lg border border-slate-200 object-contain p-1.5"
            />
          )}
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              {settings.company_name || t.appName}
            </p>
            {settings.company_address && (
              <p className="text-xs text-slate-500">{settings.company_address}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-slate-400">
            {t.contracts.print.title}
          </p>
          <p className="text-2xl font-bold text-slate-900">№{contract.number || "—"}</p>
          {contract.signed_date && (
            <p className="text-xs text-slate-500">{contract.signed_date}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 px-8 py-8 text-[13.5px] leading-[1.8] text-slate-800">
        {renderedText.split("\n\n").map((block, i) => {
          const lines = block.split("\n");
          return (
            <div key={i} className="flex flex-col gap-1.5">
              {lines.map((line, j) => {
                if (line.includes("\t")) {
                  const [left, right] = line.split("\t");
                  return (
                    <div key={j} className="flex items-baseline justify-between gap-8">
                      <span>{left}</span>
                      <span>{right}</span>
                    </div>
                  );
                }
                const isHeader = j === 0 && (lines.length > 1 || line.trim().endsWith(":"));
                return (
                  <p
                    key={j}
                    className={
                      isHeader ? "font-semibold text-slate-900" : "text-left text-slate-700"
                    }
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-px border-t border-slate-200 bg-slate-200 text-center print:border-slate-300">
        <div className="bg-slate-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {t.contracts.form.amount}
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {formatCurrency(contract.amount, contract.currency)}
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {t.contracts.form.paidAmount}
          </p>
          <p className="mt-1 font-semibold text-emerald-600">
            {formatCurrency(contract.paid_amount, contract.currency)}
          </p>
        </div>
        <div className="bg-slate-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {t.buildings.hover.remaining}
          </p>
          <p className="mt-1 font-semibold text-amber-600">
            {formatCurrency(remaining, contract.currency)}
          </p>
        </div>
      </div>

      {payments.length > 0 && (
        <section className="border-t border-slate-200 px-8 py-6">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {t.contracts.payments.title}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-1.5 font-medium">{t.contracts.payments.dueDate}</th>
                <th className="py-1.5 font-medium">{t.contracts.payments.amount}</th>
                <th className="py-1.5 font-medium">{t.contracts.payments.paid}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5">{p.due_date}</td>
                  <td className="py-1.5">{formatCurrency(p.amount, contract.currency)}</td>
                  <td className="py-1.5">
                    {p.paid ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="border-t-4 border-slate-900" />
    </div>
  );
}
