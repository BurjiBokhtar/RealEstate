"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency } from "@/lib/currency";
import { SendActions } from "@/components/SendActions";
import { receiptNumberFor } from "@/lib/contracts/receiptNumber";
import { useRole } from "@/lib/auth/useRole";
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
  const { role } = useRole();
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const { error } = await supabase.schema("crm").rpc("set_payment_paid", {
      p_payment_id: payment.id,
      p_paid: !payment.paid,
    });
    if (error) {
      setRecordError(error.message);
      return;
    }
    await load();
    onPaymentAdded?.();
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

  const handleDeletePayment = async (payment: ContractPayment) => {
    if (!window.confirm(t.contracts.payments.confirmDelete)) return;
    setDeletingId(payment.id);
    setRecordError(null);
    const supabase = createClient();
    const { error } = await supabase
      .schema("crm")
      .from("contract_payments")
      .delete()
      .eq("id", payment.id);
    if (error) {
      setRecordError(error.message);
      setDeletingId(null);
      return;
    }
    // Deleting a payment that had already been counted as paid must also
    // give that amount back on the contract, or paid_amount (and the
    // object's sold/reserved status derived from it) silently drifts wrong.
    if (payment.paid) {
      await supabase
        .schema("crm")
        .from("contracts")
        .update({ paid_amount: Math.max(contract.paid_amount - payment.amount, 0) })
        .eq("id", contract.id);
    }
    setDeletingId(null);
    await load();
    onPaymentAdded?.();
  };

  const paidCount = payments.filter((p) => p.paid).length;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{t.contracts.payments.title}</p>
        {payments.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {paidCount}/{payments.length}
          </span>
        )}
      </div>

      {/* Recording a payment is the thing staff do here most often --
          it gets the prominent spot at the top, not buried under a table. */}
      <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">{t.contracts.payments.recordTitle}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs">
            <span className="text-slate-500">{t.contracts.payments.amount}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className={`${FIELD_CLASS} w-full`}
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
        </div>
        <button
          type="button"
          onClick={handleRecordPayment}
          disabled={recording || !newAmount}
          className="h-9 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {recording ? t.common.loading : t.contracts.payments.record}
        </button>
        {recordError && <p className="text-xs text-red-600">{recordError}</p>}
      </div>

      {payments.length === 0 && contract.payment_type === "installment" && (
        <>
          <p className="text-sm text-slate-400">{t.contracts.payments.generateHint}</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !contract.installment_months}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
          >
            {t.contracts.payments.generate}
          </button>
        </>
      )}

      {payments.length > 0 && (
        <div className="flex flex-col gap-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-200"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(p.amount, contract.currency)}
                  </span>
                  <span className="text-xs text-slate-400">
                    №{receiptNumberFor(payments, p.id)} · {p.due_date}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => togglePaid(p)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                    p.paid
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  }`}
                >
                  {p.paid ? t.contracts.payments.markUnpaid : t.contracts.payments.markPaid}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-1.5">
                <Link
                  href={`/contracts/${contract.id}/payments/${p.id}/receipt`}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline"
                >
                  {t.contracts.receipt.print}
                </Link>
                <div className="flex items-center gap-2">
                  {p.paid && (
                    <SendActions contractId={contract.id} kind="receipt" paymentId={p.id} />
                  )}
                  {role === "admin" && (
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(p)}
                      disabled={deletingId === p.id}
                      className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
                    >
                      {t.contracts.payments.deletePayment}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
