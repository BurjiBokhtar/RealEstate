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

// How much of each planned installment is already covered by the money
// actually received. Clients rarely pay the exact installment -- sometimes
// more, sometimes less -- so nobody hand-marks plan rows anymore: the
// received total flows into the plan oldest-first (FIFO). A row is
// "covered" when enough real money has arrived to fill it, "partial" while
// it's filling, "upcoming" after the pool runs dry.
//
// The pool is (paid_amount) minus the share of the contract that was never
// part of the plan (the down payment): plan rows always sum to
// amount - downPayment, so pool = paid_amount - (amount - planTotal).
type PlanRowState = { covered: number; state: "covered" | "partial" | "upcoming" };

function allocatePlan(
  contract: Contract,
  planRows: ContractPayment[]
): Map<string, PlanRowState> {
  const planTotal = planRows.reduce((sum, p) => sum + p.amount, 0);
  let pool = Math.max(0, contract.paid_amount - (contract.amount - planTotal));
  const result = new Map<string, PlanRowState>();
  for (const row of planRows) {
    const covered = Math.min(pool, row.amount);
    pool -= covered;
    result.set(row.id, {
      covered,
      state:
        covered >= row.amount - 0.005 ? "covered" : covered > 0 ? "partial" : "upcoming",
    });
  }
  return result;
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
  const [expanded, setExpanded] = useState(false);

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
    // Deleting a payment that had already been counted as paid must also
    // give that amount back on the contract, or paid_amount (and the
    // object's sold/reserved status derived from it) drifts wrong -- the
    // RPC does the delete and the paid_amount adjustment as one atomic
    // update instead of reading contract.paid_amount from this component's
    // (possibly stale) props and writing back a computed value.
    const { error } = await supabase.schema("crm").rpc("delete_payment", {
      p_payment_id: payment.id,
    });
    setDeletingId(null);
    if (error) {
      setRecordError(error.message);
      return;
    }
    await load();
    onPaymentAdded?.();
  };

  const readOnly = role === "director";

  // Received money (receipts), newest first; the plan stays due-date
  // ordered because receipt numbers derive from that ordering.
  const paidPayments = payments
    .filter((p) => p.paid)
    .sort((a, b) => (b.paid_date ?? b.due_date).localeCompare(a.paid_date ?? a.due_date));
  const planRows = payments.filter((p) => !p.paid);
  const allocation = allocatePlan(contract, planRows);

  const coveredCount = planRows.filter(
    (p) => allocation.get(p.id)?.state === "covered"
  ).length;
  const nextDue =
    planRows.find((p) => allocation.get(p.id)?.state !== "covered") ?? null;
  const nextDueRemaining = nextDue
    ? nextDue.amount - (allocation.get(nextDue.id)?.covered ?? 0)
    : 0;

  const paidPct =
    contract.amount > 0
      ? Math.min(Math.round((contract.paid_amount / contract.amount) * 100), 100)
      : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{t.contracts.payments.title}</p>
        {planRows.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {coveredCount}/{planRows.length}
          </span>
        )}
      </div>

      {/* Recording a payment is the thing staff do here most often --
          it gets the prominent spot at the top, not buried under a table.
          Directors watch, they don't take money. */}
      {!readOnly && (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">
            {t.contracts.payments.recordTitle}
          </p>
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
            className="h-9 w-full rounded-lg bg-brand text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {recording ? t.common.loading : t.contracts.payments.record}
          </button>
          {recordError && <p className="text-xs text-red-600">{recordError}</p>}
        </div>
      )}

      {!readOnly && payments.length === 0 && contract.payment_type === "installment" && (
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

      {/* Compact by default: overall progress + the next thing due. The
          full plan opens on demand. */}
      {payments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
          {nextDue && (
            <p className="text-xs text-slate-500">
              {t.contracts.payments.nextDue}:{" "}
              <span className="font-semibold text-slate-700">{nextDue.due_date}</span> ·{" "}
              <span className="font-semibold text-slate-700">
                {formatCurrency(nextDueRemaining, contract.currency)}
              </span>
            </p>
          )}
          {planRows.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              {expanded
                ? t.contracts.payments.hideSchedule
                : `${t.contracts.payments.showSchedule} (${planRows.length})`}
            </button>
          )}
        </div>
      )}

      {/* Money actually received -- always visible, newest first. Every row
          is a real receipt with its print/send/delete actions. */}
      {paidPayments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.clients.paymentHistory.title}
          </p>
          {paidPayments.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2.5 transition-colors hover:border-emerald-200"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(p.amount, contract.currency)}
                  </span>
                  <span className="text-xs text-slate-400">
                    №{receiptNumberFor(payments, p.id)} · {p.paid_date ?? p.due_date}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  ✓ {t.clients.paymentHistory.paid}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100/60 pt-1.5">
                <Link
                  href={`/contracts/${contract.id}/payments/${p.id}/receipt`}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  🖨 {t.contracts.receipt.print}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SendActions contractId={contract.id} kind="receipt" paymentId={p.id} />
                  {role === "admin" && (
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(p)}
                      disabled={deletingId === p.id}
                      title={t.contracts.payments.deletePayment}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The plan, with each installment's coverage DERIVED from received
          money (oldest first) -- nothing here is ever hand-marked, so a
          client paying 5 000 against a 10 000 installment shows exactly
          that: 5 000 / 10 000, not a wrongly "paid" row. */}
      {expanded && planRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.contracts.payments.scheduleTitle}
          </p>
          {planRows.map((p) => {
            const a = allocation.get(p.id) ?? { covered: 0, state: "upcoming" as const };
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 transition-colors ${
                  a.state === "covered"
                    ? "border-emerald-100 bg-emerald-50/30"
                    : a.state === "partial"
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">
                      {a.state === "partial"
                        ? `${formatCurrency(a.covered, contract.currency)} / ${formatCurrency(p.amount, contract.currency)}`
                        : formatCurrency(p.amount, contract.currency)}
                    </span>
                    <span className="text-xs text-slate-400">{p.due_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {a.state === "covered" && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        ✓ {t.contracts.payments.covered}
                      </span>
                    )}
                    {a.state === "partial" && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {Math.round((a.covered / p.amount) * 100)}%
                      </span>
                    )}
                    {role === "admin" && (
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(p)}
                        disabled={deletingId === p.id}
                        title={t.contracts.payments.deletePayment}
                        className="flex items-center rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {a.state === "partial" && (
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                      style={{ width: `${(a.covered / p.amount) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
