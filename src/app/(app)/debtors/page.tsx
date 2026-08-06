"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatShortDate } from "@/lib/formatDate";
import { ExportMenu } from "@/components/ExportMenu";
import { waLink } from "@/lib/whatsapp";

// One reminder PER CONTRACT, not per missed installment. A long installment
// plan with nothing paid used to spill one row per overdue month (9, 20, 30
// rows for the same flat); now it's a single line summing what's overdue.
// Paid installments drop out on their own, so recording a payment shrinks the
// reminder and fully closing the plan removes it entirely.
type ContractDebt = {
  contractId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  objectName: string | null;
  contractNumber: string | null;
  currency: Currency;
  missedCount: number;
  totalOverdue: number;
  // Earliest missed date = since when in arrears; latest = the current period
  // to chase. Days overdue is measured from the latest, so it reflects the
  // present cycle and rolls forward each month instead of ballooning to 785.
  earliestDue: string;
  latestDue: string;
  daysOverdue: number;
};

// A row exactly as crm.overdue_contracts() returns it.
type OverdueRow = {
  contract_id: string;
  contract_number: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  object_name: string | null;
  currency: Currency;
  missed_count: number;
  total_overdue: number;
  earliest_due: string;
  latest_due: string;
};

export default function DebtorsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<ContractDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  // Grouped in SQL, one row per contract. This page used to pull EVERY unpaid
  // overdue installment and group them in the browser -- and a two-year
  // installment plan is 20-30 rows on its own, so PostgREST's 1000-row cap was
  // reachable with only a few dozen debtors. Past that, the list silently went
  // short: a debtor who owed money simply didn't appear, with no error. One
  // contract now costs one row.
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    createClient()
      .schema("crm")
      .rpc("overdue_contracts")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("overdue_contracts failed:", error.message);
          setFailure(error.message);
          setRows([]);
          setLoading(false);
          return;
        }
        const now = Date.now();
        setFailure(null);
        setRows(
          ((data ?? []) as OverdueRow[]).map((r) => ({
            contractId: r.contract_id,
            clientId: r.client_id,
            clientName: r.client_name,
            clientPhone: r.client_phone,
            objectName: r.object_name,
            contractNumber: r.contract_number,
            currency: r.currency,
            missedCount: r.missed_count,
            totalOverdue: Number(r.total_overdue),
            earliestDue: r.earliest_due,
            latestDue: r.latest_due,
            // Measured from the LATEST missed date, so it reflects the current
            // cycle and rolls forward each month instead of ballooning.
            daysOverdue: Math.floor((now - new Date(r.latest_due).getTime()) / 86_400_000),
          }))
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const totals = useMemo(() => {
    const v: Record<string, number> = {};
    for (const r of rows) v[r.currency] = (v[r.currency] ?? 0) + r.totalOverdue;
    return Object.entries(v).filter(([, n]) => n > 0);
  }, [rows]);

  const getExportRows = async () => {
    const num = (n: number) => n.toFixed(2).replace(".", ",");
    return rows.map((r) => [
      r.clientName,
      r.clientPhone ?? "",
      r.objectName ?? "",
      r.contractNumber ?? "",
      r.earliestDue,
      r.missedCount,
      num(r.totalOverdue),
      r.currency,
    ]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.debtors.title}</h1>
          <p className="text-sm text-slate-500">{t.debtors.subtitle}</p>
        </div>
        {rows.length > 0 && (
          <ExportMenu
            getData={getExportRows}
            headers={[
              t.debtors.client,
              t.clients.table.phone,
              t.debtors.object,
              "№",
              t.debtors.dueDate,
              t.debtors.paymentsShort,
              t.debtors.amount,
              "Валюта",
            ]}
            filenameBase="debtors"
            title={t.debtors.title}
          />
        )}
      </div>

      {!configured && <SetupNotice />}

      {failure && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">{t.dashboard.summaryFailed}</p>
          <p className="mt-1 text-xs opacity-80">{failure}</p>
        </div>
      )}

      {totals.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {totals.map(([cur, sum]) => (
            <div
              key={cur}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                {t.debtors.totalOverdue}
              </div>
              <div className="text-xl font-bold text-rose-700">
                {formatCurrency(sum, cur as Currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="animate-fade-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.debtors.client}</th>
              <th className="px-4 py-3 font-medium">{t.debtors.object}</th>
              <th className="px-4 py-3 font-medium">{t.debtors.dueDate}</th>
              <th className="px-4 py-3 text-right font-medium">{t.debtors.overdue}</th>
              <th className="px-4 py-3 text-right font-medium">{t.debtors.amount}</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-emerald-600">
                  {t.debtors.empty}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.contractId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  {r.clientId ? (
                    <Link
                      href={`/clients/${r.clientId}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {r.clientName}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-900">{r.clientName}</span>
                  )}
                  {r.clientPhone && (
                    <div className="text-xs text-slate-400">{r.clientPhone}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.objectName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatShortDate(r.earliestDue)}
                  {r.missedCount > 1 && (
                    <span className="block text-xs text-slate-400">
                      {t.debtors.since} · {formatShortDate(r.latestDue)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.missedCount > 1
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                    title={`${r.daysOverdue} ${t.debtors.days}`}
                  >
                    {r.missedCount} {t.debtors.paymentsShort}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-rose-600">
                  {formatCurrency(r.totalOverdue, r.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.clientPhone ? (
                    <a
                      href={waLink(
                        r.clientPhone,
                        t.debtors.reminderMsg
                          .replace("{name}", r.clientName)
                          .replace("{contract}", r.contractNumber ?? "—")
                          .replace(
                            "{amount}",
                            formatCurrency(r.totalOverdue, r.currency)
                          )
                          .replace("{days}", String(r.daysOverdue))
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t.debtors.whatsapp}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-1.5-.5c-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.3 0 .5l-.3.5-.4.5c-.2.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.9 1.7 1.1 2 1.3.2.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" /></svg>
                      {t.debtors.whatsapp}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300">{t.debtors.noPhone}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
