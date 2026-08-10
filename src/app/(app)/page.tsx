"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { DashboardHero } from "@/components/DashboardHero";
import { RevenueAreaChart, type RevenueMonth } from "@/components/RevenueAreaChart";
import { RingChart } from "@/components/charts/RingChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { STATUS_HUES, BUILDING_HUES, buildingHues } from "@/components/charts/palette";
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
  // Area per status: the ring needs the sold and reserved shares too, which no
  // tile ever showed.
  area_split: { sold: number; reserved: number; available: number; rented: number; in_progress: number };
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
  area_split: { sold: 0, reserved: 0, available: 0, rented: 0, in_progress: 0 },
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
  const configured = isSupabaseConfigured();
  // "Loading" is derived, not stored. It is exactly "the figures on screen do
  // not belong to the building and period currently selected", so it is a
  // comparison, not a flag raised before the RPC and lowered after. Not
  // configured means nothing will ever load, so it is not loading either.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
  const queryKey = [selectedBuildingId, periodBounds?.start ?? "", periodBounds?.end ?? ""].join(
    "|"
  );
  const loading = configured && loadedKey !== queryKey;

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
    if (!configured) return;
    let cancelled = false;
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
        setLoadedKey(queryKey);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, selectedBuildingId, periodBounds, queryKey]);

  const counts = summary.counts;
  const area = summary.area;
  const paidRevenue = summary.paid;
  const totalDebt = summary.debt;
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

  // One colour per building, shared by the rings and the revenue tiles, so a
  // building is the same colour wherever it appears. Built from both lists:
  // a building can have sold nothing yet still be missing from one of them.
  const hueById = useMemo(
    () =>
      buildingHues([
        ...summary.occupancy.map((b) => b.id),
        ...summary.revenue_by_building.map((b) => b.id),
      ]),
    [summary.occupancy, summary.revenue_by_building]
  );

  // Ranked most-sold first, so the ring you read first is the one that
  // matters. "Sold" folds in rented: both mean the flat is no longer for
  // sale, which is what the ring is measuring.
  const occupancyRings = useMemo(
    () =>
      occupancy
        .map((b) => ({
          id: b.id,
          label: b.name,
          sold: b.counts.sold + b.counts.rented,
          reserved: b.counts.reserved,
          total: b.total,
          hue: hueById.get(b.id) ?? BUILDING_HUES[0],
        }))
        .sort((a, x) => (x.total ? x.sold / x.total : 0) - (a.total ? a.sold / a.total : 0)),
    [occupancy, hueById]
  );

  // Floor area as a composition. Only non-zero statuses become slices, so a
  // building with no rentals doesn't get a zero-width band in the ring.
  const areaSlices = useMemo(() => {
    const order: Array<{ key: ObjectStatus; value: number }> = [
      { key: "sold", value: summary.area_split.sold },
      { key: "reserved", value: summary.area_split.reserved },
      { key: "available", value: summary.area_split.available },
      { key: "rented", value: summary.area_split.rented },
      { key: "in_progress", value: summary.area_split.in_progress },
    ];
    return order
      .filter((s) => s.value > 0)
      .map((s) => ({
        key: s.key,
        label: t.objects.statuses[s.key],
        value: s.value,
        hue: STATUS_HUES[s.key],
      }));
  }, [summary.area_split, t]);

  // Revenue per building, split by currency and ranked WITHIN each currency.
  // Buildings that earned nothing in a currency drop out of that block rather
  // than sitting there as a zero-length bar.
  const revenueByCurrency = useMemo(() => {
    return (["TJS", "USD"] as Currency[])
      .map((currency) => ({
        currency,
        rows: revenueByBuilding
          .map((b) => ({ id: b.id, name: b.name, value: currency === "USD" ? b.usd : b.tjs }))
          .filter((r) => r.value > 0)
          .sort((a, b) => b.value - a.value),
      }))
      .filter((block) => block.rows.length > 0);
  }, [revenueByBuilding]);

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
      {/* Overdue is gone from here: it now has a chart of its own on the
          debtors page, where the follow-up actually happens. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
          {dailyRevenue.some((d) => d.tjs > 0 || d.usd > 0) ? (
            <RevenueAreaChart data={dailyRevenue} />
          ) : (
            <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByMonth}
        </p>
        {revenue.some((d) => d.tjs > 0 || d.usd > 0) ? (
          <RevenueAreaChart data={revenue} />
        ) : (
          <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
        )}
      </div>

      {/* Side by side, not stacked a screen apart: these two answer the same
          question about the same buildings ("how is each ЖК doing"), and
          comparing them meant scrolling between them. */}
      {/* Occupancy and the area split share one row. The area donut used to
          have a full-width card to itself, which put a 210px ring in the
          middle of a 1150px card and left the rest of it blank -- the widest
          stretch of nothing on the page. Both cards stretch to the same
          height and centre their chart inside it, so the shorter of the two
          does not end in a void either. */}
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        {/* Occupancy as one horizontal bar per building, each drawn to 100% of
            its own total, sorted by the share sold. Columns shared the card's
            width between them, so every building added made all of them
            narrower -- past a dozen or so the names had nowhere to go and
            dropped out of the chart entirely. Rows spend width on the bar and
            height on the list, so the name stays readable at any number of
            buildings, and the order answers "what is nearly gone" on sight. */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">
              {t.dashboard.occupancyByBuilding}
            </p>
            {/* The colour of a ring says WHICH building, so it cannot also
                say which status. The two tints do that, and the key shows
                them in neutral grey rather than claiming a hue. */}
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
                {t.objects.statuses.sold}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                {t.objects.statuses.reserved}
              </span>
            </div>
          </div>
          {occupancy.length > 0 ? (
            <div className="flex flex-1 items-center">
              <RingChart data={occupancyRings} />
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
          )}
        </div>

        {/* Floor area as a composition: "total" and "still for sale" were two
            tiles you had to divide in your head. As a ring the split reads at
            a glance, and the sold/reserved shares come free. Sized smaller
            than the revenue ring -- this is the supporting figure. */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700">{t.dashboard.areaSplit}</p>
          {area.total > 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <DonutChart
                slices={areaSlices}
                size={170}
                thickness={26}
                centerLabel={t.dashboard.totalArea}
                formatValue={formatArea}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t.dashboard.noData}</p>
          )}
        </div>

      </div>

      {/* Revenue by building, ONE BLOCK PER CURRENCY.
          The bar used to be as long as tjs + usd and the headline number was
          that sum -- 10 265 129 TJS plus 419 395 USD shown as "10,7 млн",
          which is 10.7 million of nothing. Adding two currencies produces a
          figure that does not exist, and the real amounts were relegated to
          grey small print underneath. Each currency now gets its own block,
          its own scale and its own full-size figures. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-slate-700">
          {t.dashboard.revenueByBuilding}
        </p>
        {revenueByCurrency.length > 0 ? (
          <div
            className={`grid gap-6 ${
              revenueByCurrency.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {revenueByCurrency.map(({ currency, rows }) => (
              <DonutChart
                key={currency}
                size={240}
                thickness={34}
                centerLabel={currency}
                slices={rows.map((r) => ({
                  key: r.id,
                  label: r.name,
                  value: r.value,
                  hue: hueById.get(r.id) ?? BUILDING_HUES[0],
                }))}
                formatValue={(n) => formatCurrency(n, currency)}
              />
            ))}
          </div>
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
