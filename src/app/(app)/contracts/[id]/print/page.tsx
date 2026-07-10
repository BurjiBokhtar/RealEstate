"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { formatCurrency } from "@/lib/currency";
import { renderContractTemplate } from "@/lib/contracts/renderTemplate";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

type ContractWithRelations = Contract & {
  client: { name: string; phone: string | null; passport: string | null } | null;
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
        "*, client:clients(name, phone, passport), object:objects(name, address, area, building:buildings(address, price_per_sqm))"
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

  if (!settings.contract_template) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-slate-500">{t.settings.template.hint}</p>
        <Link
          href="/settings"
          className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.nav.settings} →
        </Link>
      </div>
    );
  }

  const renderedText = renderContractTemplate(settings.contract_template, {
    contract_number: contract.number ?? "",
    signed_date: contract.signed_date ?? "",
    client_name: contract.client?.name ?? "",
    client_passport: contract.client?.passport ?? "",
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 bg-white p-8 print:p-0">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 print:hidden"
      >
        {t.contracts.print.button}
      </button>

      <div className="flex flex-col gap-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {renderedText.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <div className="flex justify-between text-sm text-slate-500">
        <span>
          {t.contracts.form.paidAmount}: {formatCurrency(contract.paid_amount, contract.currency)}
        </span>
        <span>{t.contracts.statuses[contract.status]}</span>
      </div>

      {payments.length > 0 && (
        <section>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {t.contracts.payments.title}
          </p>
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
                  <td className="py-1">{formatCurrency(p.amount, contract.currency)}</td>
                  <td className="py-1">{p.paid ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
