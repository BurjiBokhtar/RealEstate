"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency } from "@/lib/currency";
import { SendActions } from "@/components/SendActions";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import type { Contract, ContractPayment } from "@/lib/contracts/types";

const FIELD_CLASS =
  "h-9 rounded-lg border border-slate-300 px-2.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ContractPayments({
  contract,
  onPaymentAdded,
}: {
  contract: Contract;
  onPaymentAdded?: () => void;
}) {
  const { t } = useLocale();
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    const months = contract.installment_months ?? 0;
    if (!months) return;
    setGenerating(true);
    const remaining = contract.amount - contract.paid_amount;
    const base = Math.floor((remaining / months) * 100) / 100;
    const baseDate = contract.signed_date ?? today();
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
        paid_date: !payment.paid ? today() : null,
      })
      .eq("id", payment.id);
    await load();
  };

  const handleRecordPayment = async () => {
    const amount = Number(newAmount);
    if (!amount || amount <= 0) return;
    setRecording(true);
    setRecordError(null);
    const supabase = createClient();
    const { error } = await supabase.schema("crm").rpc("record_payment", {
      p_contract_id: contract.id,
      p_amount: amount,
      p_date: newDate,
    });
    setRecording(false);
    if (error) {
      setRecordError(error.message);
      return;
    }
    setNewAmount("");
    setNewDate(today());
    await load();
    onPaymentAdded?.();
  };

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700">{t.contracts.payments.title}</p>

      {payments.length === 0 && contract.payment_type === "installment" && (
        <>
          <p className="text-sm text-slate-400">{t.contracts.payments.generateHint}</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !contract.installment_months}
            className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
          >
            {t.contracts.payments.generate}
          </button>
        </>
      )}

      {payments.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 font-medium">№</th>
              <th className="py-2 font-medium">{t.contracts.payments.dueDate}</th>
              <th className="py-2 font-medium">{t.contracts.payments.amount}</th>
              <th className="py-2 font-medium">{t.contracts.payments.paid}</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 text-slate-400">{receiptNumberFor(payments, p.id)}</td>
                <td className="py-2">{p.due_date}</td>
                <td className="py-2">{formatCurrency(p.amount, contract.currency)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => togglePaid(p)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                      p.paid
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {p.paid ? t.contracts.payments.markUnpaid : t.contracts.payments.markPaid}
                  </button>
                </td>
                <td className="py-2">
                  <div className="flex flex-col items-start gap-1.5">
                    <Link
                      href={`/contracts/${contract.id}/payments/${p.id}/receipt`}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      {t.contracts.receipt.print}
                    </Link>
                    {p.paid && (
                      <SendActions contractId={contract.id} kind="receipt" paymentId={p.id} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-500">{t.contracts.payments.recordTitle}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-500">{t.contracts.payments.amount}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className={`${FIELD_CLASS} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-500">{t.contracts.payments.dueDate}</span>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <button
            type="button"
            onClick={handleRecordPayment}
            disabled={recording || !newAmount}
            className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {recording ? t.common.loading : t.contracts.payments.record}
          </button>
        </div>
        {recordError && <p className="text-xs text-red-600">{recordError}</p>}
      </div>
    </div>
  );
}
