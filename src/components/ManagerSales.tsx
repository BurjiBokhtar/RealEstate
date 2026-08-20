"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency, type Currency } from "@/lib/currency";
import { ControlGroup, PillButton } from "@/components/ActionBar";
import { CURRENCY_HUES } from "@/components/charts/palette";
import { CalendarIcon, HomeIcon } from "@/components/icons";
import type { Building } from "@/lib/buildings/types";

type PeriodFilter = "all" | "today" | "month" | "year";

// One icon, one native <select> beside it -- the minimum that still reads as
// "this is a filter" rather than a label. Matches the hero row's own glass
// selects in behaviour, just styled for a white card instead of the hero's
// dark gradient.
function IconSelect({
  icon,
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex h-8 items-center gap-1 rounded-md border border-[var(--border-c)] bg-[var(--surface-1)] pl-1.5 pr-1 text-[var(--ink-5)] transition-colors hover:border-[var(--border-strong-c)]">
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 max-w-[9rem] truncate border-0 bg-transparent py-0 pl-0.5 pr-4 text-xs font-medium text-[var(--ink-3)] focus:outline-none focus:ring-0"
      >
        {children}
      </select>
    </label>
  );
}

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
//
// periodFilter/onPeriodChange/buildings/selectedBuildingId/onBuildingChange
// are the SAME state the hero row's own selects read and write -- this panel
// gets its own compact controls rather than a second, independent scope,
// because two filters on one screen disagreeing about which ЖК is selected
// would be far more confusing than this panel having none of its own. Change
// either one here and the hero row (and every other card on the page) moves
// with it.
export function ManagerSales({
  periodBounds,
  buildingId,
  periodFilter,
  onPeriodChange,
  buildings,
  selectedBuildingId,
  onBuildingChange,
}: {
  periodBounds?: PeriodBounds;
  buildingId?: string | null;
  periodFilter: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  buildings: Building[];
  selectedBuildingId: string;
  onBuildingChange: (id: string) => void;
}) {
  const { t } = useLocale();
  const { role } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  // A manager with deals in both currencies used to take two rows, back to
  // back, with nothing on screen saying why the same name repeats. "Все"
  // stays the default -- the split only shows once there is one to make.
  const [currencyFilter, setCurrencyFilter] = useState<Currency | null>(null);

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

  const currencies = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.currency))),
    [rows]
  );
  // Falls back to "Все" during render rather than an effect that resets the
  // state: switching building or period can make the picked currency vanish
  // from the data, and there is nothing to synchronise with an external
  // system here -- just a stale selection to ignore until it is valid again.
  const activeCurrency = currencyFilter && currencies.includes(currencyFilter) ? currencyFilter : null;

  if (role !== "admin" && role !== "director") return null;
  if (rows === null) return null;

  const visibleRows = activeCurrency ? rows.filter((r) => r.currency === activeCurrency) : rows;

  return (
    <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink-2)]">{t.dashboard.byManager}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <IconSelect
            icon={<CalendarIcon className="h-3.5 w-3.5 shrink-0" />}
            value={periodFilter}
            onChange={(v) => onPeriodChange(v as PeriodFilter)}
          >
            <option value="all">{t.dashboard.periodAll}</option>
            <option value="today">{t.dashboard.periodToday}</option>
            <option value="month">{t.dashboard.periodMonth}</option>
            <option value="year">{t.dashboard.periodYear}</option>
          </IconSelect>
          <IconSelect
            icon={<HomeIcon className="h-3.5 w-3.5 shrink-0" />}
            value={selectedBuildingId}
            onChange={onBuildingChange}
          >
            <option value="all">{t.dashboard.allBuildings}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </IconSelect>
          {currencies.length > 1 && (
            <ControlGroup size="sm">
              <PillButton
                label={t.dashboard.allCurrencies}
                active={activeCurrency === null}
                onClick={() => setCurrencyFilter(null)}
              />
              {currencies.map((c) => (
                <PillButton
                  key={c}
                  label={c}
                  active={activeCurrency === c}
                  onClick={() => setCurrencyFilter(c)}
                />
              ))}
            </ControlGroup>
          )}
        </div>
      </div>
      {visibleRows.length > 0 ? (
        <div className="overflow-x-auto">
          {/* px-3 on every cell -- there was none before, only vertical
              padding, so with the browser sizing each column tight to its
              own content two right-aligned numbers in neighbouring columns
              sat flush against each other with nothing between them: 85
              deals right up against 27 817 053,04 read as one number,
              8527 817 053,04. */}
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border-c)] text-[var(--ink-4)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t.dashboard.manager}</th>
                <th className="px-3 py-2 text-right font-medium">{t.dashboard.dealsCount}</th>
                <th className="px-3 py-2 text-right font-medium">{t.dashboard.dealsSum}</th>
                <th className="px-3 py-2 text-right font-medium">{t.dashboard.paidRevenue}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                // Same green/blue split the revenue chart and every other
                // currency-aware card on this dashboard already use -- a
                // TJS badge and a USD badge used to both be the same grey,
                // so "which currency" took reading the three letters
                // instead of recognising the colour at a glance.
                const hue = CURRENCY_HUES[r.currency];
                return (
                <tr
                  key={`${r.manager}-${r.currency}-${i}`}
                  className="border-b border-[var(--border-c2)] transition-colors last:border-0 hover:bg-[var(--hover-c)]"
                >
                  <td className="px-3 py-2 font-medium text-[var(--ink-2)]">
                    {r.manager}
                    {/* The same manager gets one row PER CURRENCY -- summing
                        TJS and USD into one figure would be meaningless, the
                        same reason revenue-by-building splits by currency
                        elsewhere on this dashboard. Only shown once there is
                        more than one currency to explain, so a name never
                        carries an unexplained badge in a single-currency
                        company. */}
                    {currencies.length > 1 && (
                      <span
                        className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${hue.solid}22`, color: hue.solid }}
                      >
                        {r.currency}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.contracts}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(r.total, r.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--wash-emerald-ink)]">
                    {formatCurrency(r.paid, r.currency)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-5)]">{t.dashboard.noData}</p>
      )}
    </div>
  );
}
