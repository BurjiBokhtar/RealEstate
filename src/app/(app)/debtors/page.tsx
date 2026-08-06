"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { Pagination } from "@/components/Pagination";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatShortDate } from "@/lib/formatDate";
import { ExportMenu } from "@/components/ExportMenu";
import { waLink } from "@/lib/whatsapp";

const PAGE_SIZE = 25;
// Batch size for the "export everything" path -- PostgREST will not hand back
// more than this in one response anyway.
const EXPORT_BATCH = 1000;

type SortKey = "overdue" | "oldest" | "name";

// Which column each choice orders by, applied in the database so the order
// holds across pages.
const SORTS: Record<SortKey, { column: string; ascending: boolean }> = {
  overdue: { column: "total_overdue", ascending: false },
  oldest: { column: "earliest_due", ascending: true },
  name: { column: "client_name", ascending: true },
};

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
  // The whole balance of the contract, not just the overdue slice -- the two
  // were being confused for each other on screen.
  remainingTotal: number;
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
  remaining_total: number | null;
  earliest_due: string;
  latest_due: string;
};

// Same shape the table renders, built from one RPC row.
function toDebt(r: OverdueRow, now: number): ContractDebt {
  return {
    contractId: r.contract_id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    objectName: r.object_name,
    contractNumber: r.contract_number,
    currency: r.currency,
    missedCount: r.missed_count,
    totalOverdue: Number(r.total_overdue),
    remainingTotal: Number(r.remaining_total ?? 0),
    earliestDue: r.earliest_due,
    latestDue: r.latest_due,
    // Measured from the LATEST missed date, so it reflects the current cycle
    // and rolls forward each month instead of ballooning.
    daysOverdue: Math.floor((now - new Date(r.latest_due).getTime()) / 86_400_000),
  };
}

export default function DebtorsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<ContractDebt[]>([]);
  const [totals, setTotals] = useState<
    Array<{ currency: Currency; overdue: number; remaining: number; contracts: number }>
  >([]);
  // Explicit, and visible on screen. The order used to be fixed and unstated,
  // so there was no way to tell what the list was sorted by.
  const [sort, setSort] = useState<SortKey>("overdue");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  // Paged, 25 at a time. Two ceilings had to go here. First: the page used to
  // pull EVERY unpaid overdue installment and group them in the browser -- and
  // a two-year plan is 20-30 rows on its own, so PostgREST's 1000-row cap was
  // reachable at a few dozen debtors. Migration 038 fixed that by grouping in
  // SQL. But one contract still costs one row, so the same cap returns at a
  // thousand contracts in arrears -- and on THIS page a silently truncated
  // list means somebody who owes money never gets called. Hence real paging,
  // with the row count coming from the server rather than from rows.length.
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const order = SORTS[sort];
    createClient()
      .schema("crm")
      .rpc("overdue_contracts", {}, { count: "exact" })
      // Sorted in the database, so the order holds ACROSS pages -- sorting the
      // 25 rows on screen would be a different list on every page. contract_id
      // second: without a unique tiebreaker, equal values can come back in a
      // different order per page, showing one debtor twice and another never.
      .order(order.column, { ascending: order.ascending })
      .order("contract_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .then(({ data, count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("overdue_contracts failed:", error.message);
          setFailure(error.message);
          setRows([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        const batch = (data ?? []) as OverdueRow[];
        // Debts get paid while the page is open. If that emptied the page
        // we're standing on, fall back to the first one rather than showing a
        // blank table under a "3 / 2" counter.
        if (batch.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        const now = Date.now();
        setFailure(null);
        setRows(batch.map((r) => toDebt(r, now)));
        setTotalCount(count ?? 0);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, page, sort]);

  // The headline totals cover EVERY debtor, not the 25 on screen, so they come
  // from their own aggregate instead of being summed from `rows`.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    createClient()
      .schema("crm")
      .rpc("overdue_totals")
      .then(({ data, error }) => {
        if (cancelled || error) {
          if (error) console.error("overdue_totals failed:", error.message);
          return;
        }
        setTotals(
          (
            (data ?? []) as Array<{
              currency: Currency;
              contracts: number;
              total_overdue: number;
              remaining_total: number;
            }>
          )
            .map((r) => ({
              currency: r.currency,
              contracts: r.contracts,
              overdue: Number(r.total_overdue),
              remaining: Number(r.remaining_total ?? 0),
            }))
            .filter((r) => r.overdue > 0)
        );
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Export is the whole list, not the current page -- an Excel file of 25 rows
  // out of 1200 would be quietly wrong in exactly the way this change exists
  // to prevent. Fetched in batches on demand, only when the button is pressed.
  const getExportRows = async () => {
    const num = (n: number) => n.toFixed(2).replace(".", ",");
    const supabase = createClient();
    const all: ContractDebt[] = [];
    const now = Date.now();
    for (let from = 0; ; from += EXPORT_BATCH) {
      const { data, error } = await supabase
        .schema("crm")
        .rpc("overdue_contracts")
        .range(from, from + EXPORT_BATCH - 1);
      const batch = (data ?? []) as OverdueRow[];
      if (error || batch.length === 0) break;
      all.push(...batch.map((r) => toDebt(r, now)));
      if (batch.length < EXPORT_BATCH) break;
    }
    return all.map((r) => [
      r.clientName,
      r.clientPhone ?? "",
      r.objectName ?? "",
      r.contractNumber ?? "",
      r.earliestDue,
      r.missedCount,
      num(r.totalOverdue),
      num(r.remainingTotal),
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
        {totalCount > 0 && (
          <ExportMenu
            getData={getExportRows}
            headers={[
              t.debtors.client,
              t.clients.table.phone,
              t.debtors.object,
              "№",
              t.debtors.oldestDue,
              t.debtors.missedPayments,
              t.debtors.overdueNow,
              t.debtors.remainingCol,
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

      {/* Two figures per currency, side by side and labelled, because they are
          different things and were being read as one: what is actually late,
          and the whole balance of those same contracts. */}
      {totals.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            {totals.map((row) => (
              <div
                key={row.currency}
                className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200"
              >
                <div className="bg-rose-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                    {t.debtors.overdueNow} · {row.currency}
                  </div>
                  <div className="text-xl font-bold text-rose-700">
                    {formatCurrency(row.overdue, row.currency)}
                  </div>
                  <div className="text-[11px] text-rose-400">
                    {row.contracts} {t.contracts.title.toLowerCase()}
                  </div>
                </div>
                <div className="bg-white px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t.debtors.remainingTotal}
                  </div>
                  <div className="text-xl font-bold text-slate-700">
                    {formatCurrency(row.remaining, row.currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">{t.debtors.cardsHint}</p>
        </div>
      )}

      {/* The order is a choice now, and it says which one is active. */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{t.debtors.sortLabel}:</span>
          {(
            [
              ["overdue", t.debtors.sortByOverdue],
              ["oldest", t.debtors.sortByOldest],
              ["name", t.debtors.sortByName],
            ] as Array<[SortKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSort(key);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-[0.98] ${
                sort === key
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="animate-fade-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.debtors.client}</th>
              <th className="px-4 py-3 font-medium">{t.debtors.object}</th>
              <th className="px-4 py-3 font-medium">{t.debtors.oldestDue}</th>
              <th className="px-4 py-3 text-right font-medium">{t.debtors.overdueNow}</th>
              <th className="px-4 py-3 text-right font-medium">{t.debtors.remainingCol}</th>
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
                  <span className="block text-xs text-slate-400">
                    {r.daysOverdue} {t.debtors.days}
                  </span>
                </td>
                {/* Amount first, then how many payments make it up, spelled
                    out. "9 плат." said nothing about what was owed. */}
                <td className="px-4 py-3 text-right">
                  <div className="font-semibold text-rose-600">
                    {formatCurrency(r.totalOverdue, r.currency)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.missedCount}{" "}
                    {r.missedCount === 1 ? t.debtors.missedOne : t.debtors.missedPayments}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {formatCurrency(r.remainingTotal, r.currency)}
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

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
