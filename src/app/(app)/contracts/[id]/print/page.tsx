"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
import { renderContractTemplate } from "@/lib/contracts/renderTemplate";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contracts/defaultTemplate";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
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
        "*, client:clients(name, phone, passport, passport_issued_by, birth_date, address), object:objects(name, address, area, building:buildings(address, price_per_sqm))"
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6 print:py-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Letterhead */}
        <div className="relative bg-gradient-to-r from-slate-900 to-slate-700 px-8 py-8 text-white print:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {settings.company_logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.company_logo_url}
                  alt=""
                  className="h-14 w-14 rounded-lg bg-white object-contain p-1.5"
                />
              )}
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {settings.company_name || t.appName}
                </p>
                {settings.company_address && (
                  <p className="text-xs text-slate-300">{settings.company_address}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-amber-300">
                {t.contracts.print.title}
              </p>
              <p className="text-2xl font-bold">№{contract.number || "—"}</p>
              {contract.signed_date && (
                <p className="text-xs text-slate-300">{contract.signed_date}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 whitespace-pre-wrap px-8 py-8 text-[13.5px] leading-[1.8] text-slate-800">
          {renderedText.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-justify">
              {paragraph}
            </p>
          ))}
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

        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
      </div>
    </div>
  );
}
