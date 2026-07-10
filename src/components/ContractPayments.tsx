"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency } from "@/lib/currency";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function ContractPayments({ contract }: { contract: Contract }) {
  const { t } = useLocale();
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("contract_payments")
      .select("*")
      .eq("contract_id", contract.id)
      .order("due_date", { ascending: true });
    setPayments((data ?? []) as ContractPayment[]);
  }, [contract.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (contract.payment_type !== "installment") return null;

  const handleGenerate = async () => {
    const months = contract.installment_months ?? 0;
    if (!months) return;
    setGenerating(true);
    const remaining = contract.amount - contract.paid_amount;
    const base = Math.floor((remaining / months) * 100) / 100;
    const baseDate = contract.signed_date ?? new Date().toISOString().slice(0, 10);
    const rows = Array.from({ length: months }, (_, i) => {
      const isLast = i === months - 1;
      const amount = isLast
        ? Math.round((remaining - base * (months - 1)) * 100) / 100
        : base;
      return {
        contract_id: contract.id,
        due_date: addMonths(baseDate, i + 1),
        amount,
      };
    });
    const supabase = createClient();
    await supabase.schema("crm").from("contract_payments").insert(rows);
    await load();
    setGenerating(false);
  };

  const togglePaid = async (payment: ContractPayment) => {
    const supabase = createClient();
    await supabase
      .schema("crm")
      .from("contract_payments")
      .update({
        paid: !payment.paid,
        paid_date: !payment.paid ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", payment.id);
    await load();
  };

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">{t.contracts.payments.title}</p>

      {payments.length === 0 && (
        <>
          <p className="text-sm text-slate-400">{t.contracts.payments.generateHint}</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !contract.installment_months}
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {t.contracts.payments.generate}
          </button>
        </>
      )}

      {payments.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 font-medium">{t.contracts.payments.dueDate}</th>
              <th className="py-2 font-medium">{t.contracts.payments.amount}</th>
              <th className="py-2 font-medium">{t.contracts.payments.paid}</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{p.due_date}</td>
                <td className="py-2">{formatCurrency(p.amount, contract.currency)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => togglePaid(p)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      p.paid
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.paid ? t.contracts.payments.markUnpaid : t.contracts.payments.markPaid}
                  </button>
                </td>
                <td className="py-2">
                  <Link
                    href={`/contracts/${contract.id}/payments/${p.id}/receipt`}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {t.contracts.receipt.print}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
