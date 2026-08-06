"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { DashboardHero } from "@/components/DashboardHero";
import { RevenueChart, type RevenueMonth } from "@/components/RevenueChart";
import { OccupancyBar, occShade } from "@/components/OccupancyBar";
import { ManagerSales } from "@/components/ManagerSales";
import { StatCard, StatIcons } from "@/components/StatCard";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MoneyPairValue, type MoneyPair } from "@/components/MoneyPairValue";
import type { ObjectStatus } from "@/lib/objects/types";
import type { Building } from "@/lib/buildings/types";

// ---------------------------------------------------------------------------
// Every number on this page is now computed by crm.dashboard_summary() in the
// database (migration 038) and arrives as one small JSON object.
//
// It used to fetch crm.objects, crm.contracts and crm.contract_payments in
// full and add them up in JavaScript. That is slow, but the real problem was
// correctness: PostgREST caps a response at 1000 rows, so the moment the
// company passes a thousand units -- or a thousand contracts, or a thousand
// installments -- the extra rows were silently dropped and every total on the
// screen quietly became wrong, with no error anywhere. SQL has no such cap and
// aggregates on indexes.
//
// The RPC is SECURITY INVOKER, so RLS still applies: a manager assigned to two
// buildings gets totals for those two buildings, exactly as before.
// ---------------------------------------------------------------------------

type StatusCounts = Record<ObjectStatus, number>;

type OccupancyRow = { id: string; name: string; total: number } & StatusCounts;

type DashboardSummary = {
  counts: { total: number; available: number; reserved: number; sold: number; in_progress: number };
  area: { total: number; available: number };
  potential: MoneyPair;
  // How many available flats the potential figure is built from, and how many
  // were left out because they have no price.
  potential_units: number;
  potential_no_price: number;
  paid: MoneyPair;
  debt: MoneyPair;
  overdue: MoneyPair;
  overdue_contracts: number;
  revenue_months: Array<{ month: string; tjs: number; usd: number }>;
  revenue_days: Array<{ day: string; tjs: number; usd: number }>;
  occupancy: OccupancyRow[];
  revenue_by_building: Array<{ id: string; name: string; tjs: number; usd: number }>;
  top_debtors: Array<{
    client_id: string;
    name: string;
    currency: Currency;
    remaining: number;
  }>;
  completed: { buildings: number; units: number };
};

const ZERO: MoneyPair = { tjs: 0, usd: 0 };

// What the page renders before the first response lands, and if the request
// fails -- so every reader below can stay unconditional.
const EMPTY_SUMMARY: DashboardSummary = {
  counts: { total: 0, available: 0, reserved: 0, sold: 0, in_progress: 0 },
  area: { total: 0, available: 0 },
  potential: ZERO,
  potential_units: 0,
  potential_no_price: 0,
  paid: ZERO,
  debt: ZERO,
  overdue: ZERO,
  overdue_contracts: 0,
  revenue_months: [],
  revenue_days: [],
  occupancy: [],
  revenue_by_building: [],
  top_debtors: [],
  completed: { buildings: 0, units: 0 },
};

const areaFormat = new Intl.NumberFormat("ru-RU");

function formatArea(m2: number) {
  return `${areaFormat.format(Math.round(m2))} м²`;
}

export default function DashboardPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const brandName = settings.company_name || t.appName;

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "month" | "year">("all");
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const periodBounds = useMemo(() => {
    if (periodFilter === "all") return null;
    const now = new Date();
    const start = new Date();
    if (periodFilter === "month") start.setDate(1);
    if (periodFilter === "year") start.setMonth(0, 1);
    // "today": start stays "now" — comparing date-only strings below means
    // both start and end resolve to today's date.
    return {
      start: start.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }, [periodFilter]);

  // The building list feeds the filter dropdown only, and doesn't change when
  // the filter does -- so it is fetched once, not on every re-scope.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    createClient()
      .schema("crm")
      .from("buildings")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setBuildings((data ?? []) as Building[]);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    createClient()
      .schema("crm")
      .rpc("dashboard_summary", {
        p_building_id: selectedBuildingId === "all" ? null : selectedBuildingId,
        p_from: periodBounds?.start ?? null,
        p_to: periodBounds?.end ?? null,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Loudly, not silently. The usual cause is that migration 038
          // hasn't been run on this database yet, and a dashboard full of
          // confident zeros is worse than an honest error.
          console.error("dashboard_summary failed:", error.message);
          setFailure(error.message);
          setSummary(EMPTY_SUMMARY);
        } else {
          setFailure(null);
          setSummary({ ...EMPTY_SUMMARY, ...(data as DashboardSummary | null) });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, selectedBuildingId, periodBounds]);

  const counts = summary.counts;
  const area = summary.area;
  const paidRevenue = summary.paid;
  const totalDebt = summary.debt;
  const overdue = summary.overdue;
  const potentialRevenue = summary.potential;
  const revenueByBuilding = summary.revenue_by_building;

  const revenue: RevenueMonth[] = summary.revenue_months;
  // Day-level granularity only makes sense once the period is narrowed down
  // to "today" or "month" -- at "year"/"all" scope it would be hundreds of
  // unreadable bars, so the monthly chart covers those instead. (The RPC
  // returns nothing here unless a period is set.)
  const dailyRevenue: RevenueMonth[] = useMemo(
    () =>
      periodFilter === "today" || periodFilter === "month"
        ? summary.revenue_days.map((d) => ({ month: d.day, tjs: d.tjs, usd: d.usd }))
        : [],
    [summary.revenue_days, periodFilter]
  );

  const occupancy = useMemo(
    () =>
      summary.occupancy.map((b) => ({
        id: b.id,
        name: b.name,
        total: b.total,
        counts: {
          available: b.available,
          reserved: b.reserved,
          sold: b.sold,
          rented: b.rented,
          in_progress: b.in_progress,
        } as StatusCounts,
      })),
    [summary.occupancy]
  );

  const debtors = useMemo(
    () =>
      summary.top_debtors.map((d) => ({
        clientId: d.client_id,
        clientName: d.name,
        currency: d.currency,
        remaining: d.remaining,
      })),
    [summary.top_debtors]
  );

  // A finished ЖК is done selling -- its numbers are settled history, so the
  // aggregate view drops it and folds it into one compact line instead.
  // Picking that building explicitly in the filter still shows its full data.
  const completedSummary =
    summary.completed.buildings > 0
      ? { buildingsCount: summary.completed.buildings, unitsCount: summary.completed.units }
      : null;

  return (
    <div className="flex flex-col gap-5">
      <DashboardHero
        t={t}
        loading={loading}
        brandName={brandName}
        totalUnits={counts.total}
        availableCount={counts.available}
        reservedCount={counts.reserved}
        soldCount={counts.sold}
        paidRevenue={paidRevenue}
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onBuildingChange={setSelectedBuildingId}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
      />

      {!configured && <SetupNotice />}

      {failure && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">{t.dashboard.summaryFailed}</p>
          <p className="mt-1 text-xs opacity-80">{failure}</p>
        </div>
      )}

      {selectedBuildingId === "all" && completedSummary && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          {t.dashboard.completedSummary
            .replace("{buildings}", String(completedSummary.buildingsCount))
            .replace("{units}", String(completedSummary.unitsCount))}
        </p>
      )}

      {/* Only what the hero doesn't already say: total/available/sold and
          paid revenue live up there now, so this row carries just the
          three numbers that don't. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label={t.dashboard.totalArea}
          value={formatArea(area.total)}
          sub={t.dashboard.totalAreaSub}
          icon={StatIcons.area}
          tone="indigo"
          delay={0}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.areaForSale}
          value={formatArea(area.available)}
          sub={
            area.total > 0
              ? `${Math.round((area.available / area.total) * 100)}%`
              : undefined
          }
          icon={StatIcons.tag}
          tone="emerald"
          delay={40}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.totalIncome}
          value={<MoneyPairValue value={paidRevenue} animate />}
          icon={StatIcons.coins}
          tone="emerald"
          delay={80}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.totalDebt}
          value={<MoneyPairValue value={totalDebt} animate />}
          icon={StatIcons.debt}
          tone="rose"
          delay={120}
          loading={loading}
        />
        {/* Both of these tiles were showing a number with nothing to check it
            against. Overdue now says how many contracts it covers (and that
            it is only the part not yet covered by money received), and
            potential says how many flats it is built from -- plus, when some
            are missing a price, that they are NOT in the total. A silently
            understated figure is worse than a small warning. */}
        <StatCard
          label={t.dashboard.overdueTile}
          value={<MoneyPairValue value={overdue} animate />}
          sub={
            summary.overdue_contracts > 0
              ? t.dashboard.overdueSub.replace("{n}", String(summary.overdue_contracts))
              : undefined
          }
          icon={StatIcons.warning}
          tone="rose"
          href="/debtors"
          delay={160}
          loading={loading}
        />
        <StatCard
          label={t.dashboard.potentialRevenue}
          value={<MoneyPairValue value={potentialRevenue} animate />}
          sub={
            summary.potential_no_price > 0
              ? t.dashboard.potentialNoPrice
                  .replace("{n}", String(summary.potential_units))
                  .replace("{missing}", String(summary.potential_no_price))
              : t.dashboard.potentialSub.replace("{n}", String(summary.potential_units))
          }
          icon={StatIcons.wallet}
          tone="plum"
          delay={200}
          loading={loading}
        />
      </div>

      {(periodFilter === "today" || periodFilter === "month") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700">
            {t.dashboard.revenueByDay}
          </p>
          {dailyRevenue.length > 0 ? (
            <RevenueChart data={dailyRevenue} />
          ) : (
            <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByMonth}
        </p>
        {revenue.length > 0 ? (
          <RevenueChart data={revenue} />
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.occupancyByBuilding}
        </p>
        {occupancy.length > 0 ? (
          <div className="flex flex-col gap-3">
            {occupancy.map((b) => {
              const soldPct = b.total ? Math.round((b.counts.sold / b.total) * 100) : 0;
              return (
                <div key={b.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <Link
                      href={`/buildings/${b.id}`}
                      className="font-medium text-slate-700 hover:underline"
                    >
                      {b.name}
                    </Link>
                    <span className="text-xs text-slate-400">
                      <span className="font-semibold text-brand">{soldPct}%</span> продано ·{" "}
                      {b.total}
                    </span>
                  </div>
                  <OccupancyBar counts={b.counts} total={b.total} labels={t.objects.statuses} />
                </div>
              );
            })}
            {/* Legend: which brand shade means which status. */}
            <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-slate-500">
              {(["available", "reserved", "sold"] as ObjectStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: occShade(s).background }}
                  />
                  {t.objects.statuses[s]}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByBuilding}
        </p>
        {revenueByBuilding.length > 0 ? (
          (() => {
            // Bar length = this building's revenue relative to the top one
            // (TJS + USD combined just for the visual proportion).
            const peak = Math.max(...revenueByBuilding.map((b) => b.tjs + b.usd), 1);
            return (
              <div className="flex flex-col gap-3">
                {revenueByBuilding.map((b) => (
                  <div key={b.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/buildings/${b.id}`}
                        className="text-sm font-medium text-slate-700 hover:underline"
                      >
                        {b.name}
                      </Link>
                      <span className="text-sm text-slate-700">
                        <MoneyPairValue value={{ tjs: b.tjs, usd: b.usd }} align="right" />
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${((b.tjs + b.usd) / peak) * 100}%`,
                          background: "var(--brand)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">{t.dashboard.topDebtors}</p>
        {debtors.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-2 font-medium">{t.clients.table.name}</th>
                <th className="pb-2 font-medium">{t.dashboard.remaining}</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr
                  key={`${d.clientId}-${d.currency}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2">
                    <Link href={`/clients/${d.clientId}`} className="hover:underline">
                      {d.clientName}
                    </Link>
                  </td>
                  <td className="py-2 text-rose-600">
                    {formatCurrency(d.remaining, d.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>
      <ManagerSales periodBounds={periodBounds} />
    </div>
  );
}
