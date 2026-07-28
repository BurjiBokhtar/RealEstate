"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency, type Currency } from "@/lib/currency";
import type { ContractStatus } from "@/lib/contracts/types";

export type QuickPaymentContract = {
  id: string;
  amount: number;
  paid_amount: number;
  currency: Currency;
  status: ContractStatus;
  object: { name: string } | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

// A client can own several apartments, so accepting a payment isn't just
// "how much" -- it's "how much, for which one". This sits right next to
// the client form (filling what used to be dead space on wide screens) and
// records straight through the same record_payment RPC the cash-desk page
// uses, so staff don't have to leave the client's page just to take a
// second installment.
export function ClientQuickPayment({
  contracts,
  onRecorded,
}: {
  contracts: QuickPaymentContract[];
  onRecorded: () => void;
}) {
  const { t } = useLocale();
  const eligible = contracts.filter(
    (c) => c.status !== "cancelled" && c.amount - c.paid_amount > 0
  );

  const [contractId, setContractId] = useState(eligible[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    contractId: string;
    paymentId: string;
  } | null>(null);

  // Keep the selection valid as the eligible list changes (e.g. right after
  // this same payment fully pays one off and it drops out of the list).
  useEffect(() => {
    if (!eligible.some((c) => c.id === contractId)) {
      setContractId(eligible[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible.map((c) => c.id).join(",")]);

  const selected = eligible.find((c) => c.id === contractId);
  const remaining = selected ? selected.amount - selected.paid_amount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!selected || !amountNum || amountNum <= 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    setLastReceipt(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.schema("crm").rpc("record_payment", {
      p_contract_id: selected.id,
      p_amount: amountNum,
      p_date: date,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAmount("");
    setDate(today());
    setSuccess(true);
    // record_payment returns the inserted payment row -- keep a direct
    // "print this receipt" link on screen so issuing the paper receipt is
    // one click away from taking the money, not a hunt through history.
    const payment = data as unknown as { id: string } | null;
    if (payment?.id) {
      setLastReceipt({ contractId: selected.id, paymentId: payment.id });
    }
    onRecorded();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-700">{t.clients.quickPayment.title}</p>
        <p className="text-xs text-slate-400">{t.clients.quickPayment.subtitle}</p>
      </div>

      {eligible.length === 0 ? (
        <p className="text-sm text-slate-400">{t.clients.quickPayment.noEligible}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {eligible.length > 1 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                {t.clients.quickPayment.selectContract}
              </span>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {eligible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.object?.name ?? "—"} · {t.clients.quickPayment.remainingShort}{" "}
                    {formatCurrency(c.amount - c.paid_amount, c.currency)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selected && (
            <p className="text-xs text-slate-400">
              {eligible.length === 1 && `${selected.object?.name ?? "—"} · `}
              {t.clients.quickPayment.remainingShort}{" "}
              <span className="font-medium text-slate-600">
                {formatCurrency(remaining, selected.currency)}
              </span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                {t.clients.quickPayment.amount}
                {selected ? ` (${selected.currency})` : ""}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{t.clients.quickPayment.date}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !amount}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitting ? t.common.loading : t.clients.quickPayment.submit}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <span>✓ {t.clients.quickPayment.success}</span>
              {lastReceipt && (
                <Link
                  href={`/contracts/${lastReceipt.contractId}/payments/${lastReceipt.paymentId}/receipt`}
                  className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95"
                >
                  {t.clients.quickPayment.printReceipt} →
                </Link>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
