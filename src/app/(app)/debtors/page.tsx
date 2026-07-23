"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { formatCurrency, type Currency } from "@/lib/currency";
import { ExportMenu } from "@/components/ExportMenu";

// A single overdue installment: an unpaid schedule row whose due date has
// already passed. Building status/paid_amount aren't touched here -- this is
// a read-only lens over the schedule the app already keeps.
type OverdueRow = {
  id: string;
  due_date: string;
  amount: number;
  currency: Currency;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  objectName: string | null;
  contractNumber: string | null;
  daysOverdue: number;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function DebtorsPage() {
  const { t } = useLocale();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase
      .schema("crm")
      .from("contract_payments")
      .select(
        "id, due_date, amount, contract:contracts(number, currency, status, client:clients(id, name, phone), object:objects(name))"
      )
      .eq("paid", false)
      .lt("due_date", today())
      .order("due_date", { ascending: true })
      .then(({ data }) => {
        const now = Date.now();
        const mapped: OverdueRow[] = ((data ?? []) as unknown as Array<{
          id: string;
          due_date: string;
          amount: number;
          contract: {
            number: string | null;
            currency: Currency;
            status: string;
            client: { id: string; name: string; phone: string | null } | null;
            object: { name: string } | null;
          } | null;
        }>)
          // A cancelled contract's leftover schedule rows aren't real debt.
          .filter((p) => p.contract && p.contract.status !== "cancelled")
          .map((p) => ({
            id: p.id,
            due_date: p.due_date,
            amount: p.amount,
            currency: p.contract!.currency,
            clientId: p.contract!.client?.id ?? null,
            clientName: p.contract!.client?.name ?? "—",
            clientPhone: p.contract!.client?.phone ?? null,
            objectName: p.contract!.object?.name ?? null,
            contractNumber: p.contract!.number ?? null,
            daysOverdue: Math.floor(
              (now - new Date(p.due_date).getTime()) / 86_400_000
            ),
          }));
        // Most overdue first -- the ones to chase today.
        mapped.sort((a, b) => b.daysOverdue - a.daysOverdue);
        setRows(mapped);
        setLoading(false);
      });
  }, [configured]);

  const totals = useMemo(() => {
    const v: Record<string, number> = {};
    for (const r of rows) v[r.currency] = (v[r.currency] ?? 0) + r.amount;
    return Object.entries(v).filter(([, n]) => n > 0);
  }, [rows]);

  const getExportRows = async () => {
    const num = (n: number) => n.toFixed(2).replace(".", ",");
    return rows.map((r) => [
      r.clientName,
      r.clientPhone ?? "",
      r.objectName ?? "",
      r.contractNumber ?? "",
      r.due_date,
      r.daysOverdue,
      num(r.amount),
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
              `${t.debtors.overdue} (${t.debtors.days})`,
              t.debtors.amount,
              "Валюта",
            ]}
            filenameBase="debtors"
            title={t.debtors.title}
          />
        )}
      </div>

      {!configured && <SetupNotice />}

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
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {t.common.loading}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-emerald-600">
                  {t.debtors.empty}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
                <td className="px-4 py-3 text-slate-600">{r.due_date}</td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.daysOverdue > 30
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.daysOverdue} {t.debtors.days}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-rose-600">
                  {formatCurrency(r.amount, r.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
