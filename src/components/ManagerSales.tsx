"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency, type Currency } from "@/lib/currency";

type Row = {
  manager: string;
  currency: Currency;
  contracts: number;
  total: number;
  paid: number;
};

export type PeriodBounds = { start: string; end: string } | null;

// "Sales by manager" panel: who closed how many deals, for how much, and how
// much of it is collected. Fed by the sales_by_manager RPC, which reads
// auth.users and is guarded to admin/director -- so the panel only renders
// for those roles. Managers/creator attribution comes from contracts.created_by
// (migration 030), filled automatically at booking.
//
// Both filters come straight from the dashboard's hero row (page.tsx) rather
// than from controls of this panel's own: one filter row scopes the whole
// page, and every card re-reads against the same slice the moment it changes.
//
// The building half used to stop here. The RPC took dates only, so choosing a
// ЖК up top re-scoped every figure on the page except this table, which went
// on counting deals from all of them -- two halves of one screen answering
// different questions, with totals that could not be reconciled. It now takes
// p_building_id as well (migration 048).
export function ManagerSales({
  periodBounds,
  buildingId,
}: {
  periodBounds?: PeriodBounds;
  buildingId?: string | null;
}) {
  const { t } = useLocale();
  const { role } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (role !== "admin" && role !== "director") return;
    const supabase = createClient();
    supabase
      .schema("crm")
      .rpc("sales_by_manager", {
        p_from: periodBounds?.start ?? null,
        p_to: periodBounds?.end ?? null,
        p_building_id: buildingId ?? null,
      })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [role, periodBounds, buildingId]);

  if (role !== "admin" && role !== "director") return null;
  if (rows === null) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-slate-700">{t.dashboard.byManager}</p>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{t.dashboard.manager}</th>
                <th className="pb-2 text-right font-medium">{t.dashboard.dealsCount}</th>
                <th className="pb-2 text-right font-medium">{t.dashboard.dealsSum}</th>
                <th className="pb-2 text-right font-medium">{t.dashboard.paidRevenue}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.manager}-${r.currency}-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium text-slate-800">{r.manager}</td>
                  <td className="py-2 text-right tabular-nums">{r.contracts}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(r.total, r.currency)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-emerald-600">
                    {formatCurrency(r.paid, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
      )}
    </div>
  );
}
