"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { DashboardHero } from "@/components/DashboardHero";
import { RevenueAreaChart, type RevenueMonth } from "@/components/RevenueAreaChart";
import { HBarChart } from "@/components/charts/HBarChart";
import { RingChart, type RingSegment } from "@/components/charts/RingChart";
import { StackBar } from "@/components/charts/StackBar";
import { STATUS_HUES, BUILDING_HUES, buildingHues } from "@/components/charts/palette";
import { ManagerSales } from "@/components/ManagerSales";
import { StatCard, StatIcons } from "@/components/StatCard";
import { formatCurrency, type Currency } from "@/lib/currency";
import { MoneyPairValue, type MoneyPair } from "@/components/MoneyPairValue";
import { useRole } from "@/lib/auth/useRole";
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

// What the payment schedule still expects from clients before this month ends,
// per currency (crm.due_this_month_totals, migration 064). Kept apart from
// dashboard_summary on purpose: that function is re-created wholesale by every
// migration that touches it, and a small separate call cannot break the rest
// of the page if the database has not been updated yet -- this one card says
// so, the others carry on.
type DueMonth =
  | { key: string; pair: MoneyPair; unpaidContracts: number; contracts: number }
  | { key: string; error: string };

// What came in (payments received) and what was signed (contracts) DURING the picked
// period (crm.dashboard_period_totals, block 084). dashboard_summary shows debt, stock,
// potential and area as a snapshot of today, so on its own a period changed only the
// charts -- the headline income stayed the all-time sum and the picker looked broken.
// Kept apart from dashboard_summary for the same reason as DueMonth: a database that
// has not been updated yet makes only this figure fall back, not the whole page.
type PeriodTotals =
  | { key: string; income: MoneyPair; sales: MoneyPair; contracts: number }
  | { key: string; error: string };

// Shops and offices, parking, anything let out for rent, land: counted apart from the
// flats (crm.dashboard_other_units, block 086). Its own call for the same reason as
// DueMonth -- a database that has not been updated yet must not take the page down.
type OtherGroupKey = "commercial" | "parking" | "rent" | "other";
type OtherGroup = {
  group: OtherGroupKey;
  total: number;
  available: number;
  reserved: number;
  sold: number;
  rented: number;
  in_progress: number;
  area_total: number;
  area_available: number;
  potential: MoneyPair;
  paid: MoneyPair;
  debt: MoneyPair;
};
type OtherUnits = { key: string; groups: OtherGroup[] } | { key: string; error: string };

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

// Те же цвета, что в шахматке: продано красное, забронировано жёлтое,
// свободно зелёное. Кольцо в цвете самого дома выглядело бы наряднее, но
// совпадало бы с чем угодно, кроме экрана, где эти цвета уже что-то значат.
const RING_COLORS = {
  sold: STATUS_HUES.sold.solid,
  reserved: STATUS_HUES.reserved.solid,
  free: STATUS_HUES.available.solid,
};

// Порядок легенды — как в фильтре шахматки. `segment` — как называет полосу
// кольцо, `status` — как называет её словарь.
const RING_LEGEND: Array<{ segment: RingSegment; status: ObjectStatus; color: string }> = [
  { segment: "sold", status: "sold", color: RING_COLORS.sold },
  { segment: "reserved", status: "reserved", color: RING_COLORS.reserved },
  { segment: "free", status: "available", color: RING_COLORS.free },
];

export default function DashboardPage() {
  const { t } = useLocale();
  const { settings } = useSettings();
  const brandName = settings.company_name || t.appName;
  // ManagerSales gates itself to admin/director; the layout has to know the
  // same thing so a manager's debtors card doesn't sit alone in a two-column
  // row with a blank half beside it.
  const { role } = useRole();
  const canSeeManagerSales = role === "admin" || role === "director";

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  // Наведение на пункт легенды подсвечивает эту полосу сразу во всех кольцах
  // -- так отвечаешь на "где ещё что-то свободно", не читая кольца по одному.
  const [legendSegment, setLegendSegment] = useState<RingSegment | null>(null);
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "month" | "year">("all");
  const configured = isSupabaseConfigured();
  // "Loading" is derived, not stored. It is exactly "the figures on screen do
  // not belong to the building and period currently selected", so it is a
  // comparison, not a flag raised before the RPC and lowered after. Not
  // configured means nothing will ever load, so it is not loading either.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dueMonth, setDueMonth] = useState<DueMonth | null>(null);
  const [periodTotals, setPeriodTotals] = useState<PeriodTotals | null>(null);
  const [otherUnits, setOtherUnits] = useState<OtherUnits | null>(null);

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

  // The non-flat premises of the picked building (or of every unfinished one). A snapshot
  // of today, so it does not follow the period.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const key = selectedBuildingId;
    createClient()
      .schema("crm")
      .rpc("dashboard_other_units", {
        p_building_id: selectedBuildingId === "all" ? null : selectedBuildingId,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("dashboard_other_units failed:", error.message);
          setOtherUnits({ key, error: error.message });
          return;
        }
        const num = (v: unknown) => Number(v ?? 0);
        const pair = (v: { tjs?: number; usd?: number } | undefined): MoneyPair => ({
          tjs: num(v?.tjs),
          usd: num(v?.usd),
        });
        const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
        setOtherUnits({
          key,
          groups: rows.map((r) => ({
            group: r.group as OtherGroupKey,
            total: num(r.total),
            available: num(r.available),
            reserved: num(r.reserved),
            sold: num(r.sold),
            rented: num(r.rented),
            in_progress: num(r.in_progress),
            area_total: num(r.area_total),
            area_available: num(r.area_available),
            potential: pair(r.potential as { tjs?: number; usd?: number }),
            paid: pair(r.paid as { tjs?: number; usd?: number }),
            debt: pair(r.debt as { tjs?: number; usd?: number }),
          })),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [configured, selectedBuildingId]);
  const otherGroups =
    otherUnits && otherUnits.key === selectedBuildingId && "groups" in otherUnits
      ? otherUnits.groups
      : [];
  const otherFailed =
    otherUnits && otherUnits.key === selectedBuildingId && "error" in otherUnits;

  // Income received and contracts signed inside the picked period, for the same
  // building scope. Only asked for when a period is picked ("all time" is the
  // summary's own paid figure).
  useEffect(() => {
    if (!configured || !periodBounds) return;
    let cancelled = false;
    createClient()
      .schema("crm")
      .rpc("dashboard_period_totals", {
        p_building_id: selectedBuildingId === "all" ? null : selectedBuildingId,
        p_from: periodBounds.start,
        p_to: periodBounds.end,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("dashboard_period_totals failed:", error.message);
          setPeriodTotals({ key: queryKey, error: error.message });
          return;
        }
        const d = (data ?? {}) as {
          income?: { tjs?: number; usd?: number };
          sales?: { contracts?: number; tjs?: number; usd?: number };
        };
        setPeriodTotals({
          key: queryKey,
          income: { tjs: Number(d.income?.tjs ?? 0), usd: Number(d.income?.usd ?? 0) },
          sales: { tjs: Number(d.sales?.tjs ?? 0), usd: Number(d.sales?.usd ?? 0) },
          contracts: Number(d.sales?.contracts ?? 0),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [configured, selectedBuildingId, periodBounds, queryKey]);
  // The figures for the CURRENT building and period, or nothing: while they load, or
  // if the database lacks the function, the page keeps showing the all-time income.
  const periodOk =
    periodBounds && periodTotals && periodTotals.key === queryKey && "income" in periodTotals
      ? periodTotals
      : null;
  const periodLoading = configured && periodBounds !== null && periodTotals?.key !== queryKey;

  // The same building scope as the rest of the page, and not the period: like
  // debt, this is a snapshot of the current state, not a flow over the picked
  // period. With "all" selected a finished ЖК stays out, as everywhere else
  // on this page (p_active_only); picking it explicitly shows it.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const key = selectedBuildingId;
    createClient()
      .schema("crm")
      .rpc("due_this_month_totals", {
        p_building_id: selectedBuildingId === "all" ? null : selectedBuildingId,
        p_active_only: selectedBuildingId === "all",
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("due_this_month_totals failed:", error.message);
          setDueMonth({ key, error: error.message });
          return;
        }
        const pair: MoneyPair = { tjs: 0, usd: 0 };
        let unpaidContracts = 0;
        let contracts = 0;
        for (const r of (data ?? []) as Array<{
          currency: Currency;
          contracts: number;
          unpaid_contracts: number;
          unpaid_total: number | null;
        }>) {
          // Same rule as the summary: anything that is not USD counts as TJS.
          if (r.currency === "USD") pair.usd += Number(r.unpaid_total ?? 0);
          else pair.tjs += Number(r.unpaid_total ?? 0);
          unpaidContracts += r.unpaid_contracts;
          contracts += r.contracts;
        }
        setDueMonth({ key, pair, unpaidContracts, contracts });
      });
    return () => {
      cancelled = true;
    };
  }, [configured, selectedBuildingId]);
  const dueLoading = configured && dueMonth?.key !== selectedBuildingId;

  const counts = summary.counts;
  const area = summary.area;
  // With a period picked this is what was RECEIVED in it; otherwise everything received so far.
  const paidRevenue = periodOk ? periodOk.income : summary.paid;
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

  // One colour per building, so a building is the same colour wherever it
  // appears. Still built from BOTH lists even though only revenue draws
  // buildings now: buildingHues() assigns over the sorted ids, so dropping the
  // occupancy ids would shift every colour the moment a building earns its
  // first payment and joins the revenue list.
  const hueById = useMemo(
    () =>
      buildingHues([
        ...summary.occupancy.map((b) => b.id),
        ...summary.revenue_by_building.map((b) => b.id),
      ]),
    [summary.occupancy, summary.revenue_by_building]
  );

  // Заполненность по ЖК. Дом без квартир выпадает: пустое кольцо ничего не
  // сообщает, а место в ряду занимает. "Продано" включает и сданные в
  // аренду -- обе квартиры одинаково сняты с продажи, это то, что кольцо
  // измеряет. Ранжировано по доле продано: кольцо, которое важнее всего
  // прочитать первым, стоит первым.
  const occupancyRows = useMemo(
    () =>
      summary.occupancy
        .filter((b) => b.total > 0)
        .map((b) => ({
          id: b.id,
          label: b.name,
          sold: b.sold + b.rented,
          reserved: b.reserved,
          total: b.total,
        }))
        .sort((a, b) => (b.total ? b.sold / b.total : 0) - (a.total ? a.sold / a.total : 0)),
    [summary.occupancy]
  );

  // Floor area as a composition. Only non-zero statuses become segments, so a
  // portfolio with no rentals doesn't get a zero-width band in the bar.
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

  // Same split as revenue-by-building, and for the same reason: a bar's
  // LENGTH is a claim about magnitude, and 500 USD next to 50 000 TJS on one
  // scale would draw the smaller number as the bigger bar. Usually resolves
  // to a single block -- most books run one dominant currency -- so this
  // only costs a second card on the (real, if rarer) mixed-currency month.
  const debtorsByCurrency = useMemo(() => {
    return (["TJS", "USD"] as Currency[])
      .map((currency) => ({ currency, rows: debtors.filter((d) => d.currency === currency) }))
      .filter((block) => block.rows.length > 0);
  }, [debtors]);

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
        loading={loading || periodLoading}
        brandName={brandName}
        totalUnits={counts.total}
        availableCount={counts.available}
        reservedCount={counts.reserved}
        soldCount={counts.sold}
        paidRevenue={paidRevenue}
        paidLabel={periodOk ? t.dashboard.incomeInPeriod : t.dashboard.paidRevenue}
        buildings={buildings}
        selectedBuildingId={selectedBuildingId}
        onBuildingChange={setSelectedBuildingId}
        periodFilter={periodFilter}
        onPeriodChange={setPeriodFilter}
      />

      {!configured && <SetupNotice />}

      {failure && (
        <div className="rounded-lg border border-[var(--wash-rose-border)] bg-[var(--wash-rose)] px-4 py-3 text-sm text-[var(--wash-rose-ink)]">
          <p className="font-semibold">{t.dashboard.summaryFailed}</p>
          <p className="mt-1 text-xs opacity-80">{failure}</p>
        </div>
      )}

      {selectedBuildingId === "all" && completedSummary && (
        <p className="rounded-lg border border-[var(--border-c)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--ink-4)]">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={periodOk ? t.dashboard.incomeInPeriod : t.dashboard.totalIncome}
          value={<MoneyPairValue value={paidRevenue} animate />}
          icon={StatIcons.coins}
          tone="emerald"
          delay={80}
          loading={loading || periodLoading}
        />
        <StatCard
          label={t.dashboard.totalDebt}
          value={<MoneyPairValue value={totalDebt} animate />}
          icon={StatIcons.debt}
          tone="rose"
          delay={120}
          loading={loading}
        />
        {/* Both currencies at once, like every other money card here. Jumps to
            Debtors, where the same figure is broken down per ЖК and per client. */}
        <StatCard
          label={t.dashboard.dueThisMonth}
          value={
            dueMonth && "pair" in dueMonth ? (
              <MoneyPairValue value={dueMonth.pair} animate />
            ) : (
              "—"
            )
          }
          sub={
            !dueMonth
              ? undefined
              : "error" in dueMonth
                ? t.dashboard.dueThisMonthFailed
                : dueMonth.pair.tjs > 0 || dueMonth.pair.usd > 0
                  ? t.dashboard.dueThisMonthSub.replace("{n}", String(dueMonth.unpaidContracts))
                  : dueMonth.contracts > 0
                    ? t.dashboard.dueThisMonthAllPaid
                    : t.dashboard.dueThisMonthNone
          }
          icon={StatIcons.calendar}
          tone="amber"
          href="/debtors"
          delay={160}
          loading={dueLoading}
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

      {/* With a period picked: what was signed in it, and a plain word about which
          figures do NOT follow the period (a debt or a stock of flats is a state of
          today, not something that happens "during" a month). */}
      {periodOk && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-[var(--border-c)] bg-[var(--surface-2)] px-4 py-2.5 text-xs text-[var(--ink-4)]">
          <div className="flex items-center gap-2">
            <span>{t.dashboard.periodSales}:</span>
            <span className="text-sm text-[var(--ink-2)]">
              <MoneyPairValue value={periodOk.sales} />
            </span>
            <span>
              · {t.dashboard.periodSalesCount.replace("{n}", String(periodOk.contracts))}
            </span>
          </div>
          <span>{t.dashboard.snapshotNote}</span>
        </div>
      )}

      {/* Площадь по статусам, во всю ширину: только 14px высотой, поэтому ей
          не нужна отдельная колонка. */}
      {area.total > 0 && (
        <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink-2)]">{t.dashboard.areaSplit}</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--ink-1)]">
              {formatArea(area.total)}
            </p>
          </div>
          <StackBar segments={areaSlices} formatValue={formatArea} />
        </div>
      )}

      {/* Заполненность по ЖК, под площадью: тот же вопрос ("сколько уже
          разобрано"), но в разрезе по дому, а не по статусу. Легенда
          подсвечивает одну и ту же полосу сразу во всех кольцах при
          наведении; наведение на само кольцо переключает подпись в его
          центре на ту полосу, что под курсором, и её число. */}
      {occupancyRows.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink-2)]">
              {t.dashboard.occupancyByBuilding}
            </p>
            <div className="flex flex-wrap gap-1 text-[11px] text-[var(--ink-4)]">
              {RING_LEGEND.map((l) => (
                <span
                  key={l.segment}
                  onMouseEnter={() => setLegendSegment(l.segment)}
                  onMouseLeave={() => setLegendSegment(null)}
                  className={`flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${
                    legendSegment === l.segment ? "bg-[var(--hover-c2)] text-[var(--ink-2)]" : ""
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  {t.objects.statuses[l.status]}
                </span>
              ))}
            </div>
          </div>
          <RingChart data={occupancyRows} colors={RING_COLORS} activeSegment={legendSegment} />
        </div>
      )}

      {/* Shops and offices, parking, rentals, land: their own block, never mixed into the
          flats above. A tile per group -- how many premises, how they split by status, the
          floor area, what is still unsold worth, and the money on their contracts. */}
      {otherFailed && (
        <p className="rounded-lg border border-[var(--border-c)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--ink-4)]">
          {t.dashboard.otherUnits}: {t.dashboard.otherUnitsFailed}
        </p>
      )}
      {otherGroups.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-[var(--ink-2)]">{t.dashboard.otherUnits}</p>
            <p className="text-xs text-[var(--ink-5)]">{t.dashboard.otherUnitsNote}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {otherGroups.map((g) => {
              const slices = (
                ["sold", "rented", "reserved", "available", "in_progress"] as ObjectStatus[]
              )
                .filter((s) => g[s] > 0)
                .map((s) => ({
                  key: s,
                  label: t.objects.statuses[s],
                  value: g[s],
                  hue: STATUS_HUES[s],
                }));
              const money: Array<{ label: string; value: MoneyPair }> = [
                { label: t.dashboard.potentialRevenue, value: g.potential },
                { label: t.dashboard.paidRevenue, value: g.paid },
                { label: t.dashboard.totalDebt, value: g.debt },
              ].filter((m) => m.value.tjs > 0 || m.value.usd > 0);
              return (
                <div
                  key={g.group}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border-c)] bg-[var(--surface-2)] p-3.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--ink-2)]">
                      {t.dashboard.otherGroups[g.group]}
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-[var(--ink-1)]">{g.total}</p>
                  </div>
                  <StackBar segments={slices} formatValue={(n) => String(n)} />
                  <div className="flex flex-col gap-1.5 border-t border-[var(--border-c)] pt-2.5 text-xs text-[var(--ink-4)]">
                    <div className="flex items-center justify-between gap-3">
                      <span>{t.dashboard.totalArea}</span>
                      <span className="font-semibold tabular-nums text-[var(--ink-2)]">
                        {formatArea(g.area_total)}
                      </span>
                    </div>
                    {g.area_available > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span>{t.dashboard.areaForSale}</span>
                        <span className="font-semibold tabular-nums text-[var(--ink-2)]">
                          {formatArea(g.area_available)}
                        </span>
                      </div>
                    )}
                    {money.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-3">
                        <span>{m.label}</span>
                        <span className="text-xs text-[var(--ink-2)]">
                          <MoneyPairValue value={m.value} align="right" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(periodFilter === "today" || periodFilter === "month") && (
        <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-[var(--ink-2)]">
            {t.dashboard.revenueByDay}
          </p>
          {dailyRevenue.some((d) => d.tjs > 0 || d.usd > 0) ? (
            <RevenueAreaChart data={dailyRevenue} />
          ) : (
            <p className="text-sm text-[var(--ink-5)]">{t.dashboard.noData}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-[var(--ink-2)]">
          {t.dashboard.revenueByMonth}
        </p>
        {revenue.some((d) => d.tjs > 0 || d.usd > 0) ? (
          <RevenueAreaChart data={revenue} />
        ) : (
          <p className="text-sm text-[var(--ink-5)]">{t.dashboard.noData}</p>
        )}
      </div>

      {canSeeManagerSales && (
        <ManagerSales
          periodBounds={periodBounds}
          buildingId={selectedBuildingId === "all" ? null : selectedBuildingId}
          periodFilter={periodFilter}
          onPeriodChange={setPeriodFilter}
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onBuildingChange={setSelectedBuildingId}
        />
      )}

      {/* Revenue by building, ONE CARD PER CURRENCY, as ranked bars.
          Two currencies never share a scale: adding 10 265 129 TJS to
          419 395 USD produces a figure that does not exist.

          These were rings until now, and a ring is the wrong instrument for
          this question. The top three ЖК hold 39%, 32% and 25% -- three arcs
          that look alike, so the order could only be recovered by reading the
          legend, and the two small ones (3% and 1%) were threads against the
          card's own edge. Bars turn the comparison into length against
          length, put each name beside its own bar instead of in a list to the
          side, and keep working as the company adds ЖК: the list grows
          downwards instead of the slices growing thinner. */}
      <div className={revenueByCurrency.length > 1 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {revenueByCurrency.length > 0 ? (
          revenueByCurrency.map(({ currency, rows }) => {
            const total = rows.reduce((sum, r) => sum + r.value, 0);
            return (
              <div
                key={currency}
                className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink-2)]">
                    {t.dashboard.revenueByBuilding} · {currency}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--ink-1)]">
                    {formatCurrency(total, currency)}
                  </p>
                </div>
                <HBarChart
                  data={rows.map((r) => ({
                    label: r.name,
                    value: r.value,
                    hue: hueById.get(r.id) ?? BUILDING_HUES[0],
                    // The share is what the ring used to carry, and it is worth
                    // keeping -- but as a note under its own bar rather than as
                    // the thing the reader has to decode the chart to get.
                    hint: total > 0 ? `${Math.round((r.value / total) * 100)}%` : undefined,
                  }))}
                  formatValue={(n) => formatCurrency(n, currency)}
                />
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[var(--ink-2)]">
              {t.dashboard.revenueByBuilding}
            </p>
            <p className="text-sm text-[var(--ink-5)]">{t.dashboard.noData}</p>
          </div>
        )}
      </div>

      {/* Debtors, last on the page rather than squeezed into a sidebar
          column: it earns the same width revenue-by-building gets above --
          one card per currency, ranked bars -- instead of being the one
          thing on the page narrow enough that a bar chart had no room to
          be one. */}
      <div className={debtorsByCurrency.length > 1 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {debtorsByCurrency.length > 0 ? (
          debtorsByCurrency.map(({ currency, rows }) => (
            <div
              key={currency}
              className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm"
            >
              <p className="mb-4 text-sm font-semibold text-[var(--ink-2)]">
                {t.dashboard.topDebtors}
                {debtorsByCurrency.length > 1 ? ` · ${currency}` : ""}
              </p>
              <HBarChart
                data={rows.map((d) => ({
                  label: d.clientName,
                  value: d.remaining,
                  hue: STATUS_HUES.sold,
                  href: `/clients/${d.clientId}`,
                }))}
                formatValue={(n) => formatCurrency(n, currency)}
              />
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[var(--ink-2)]">
              {t.dashboard.topDebtors}
            </p>
            <p className="text-sm text-[var(--ink-5)]">{t.dashboard.noData}</p>
          </div>
        )}
      </div>
    </div>
  );
}
