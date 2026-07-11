"use client";

import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Building } from "@/lib/buildings/types";

type PeriodFilter = "all" | "today" | "month" | "year";

const GLASS_SELECT =
  "rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40";

// The dashboard's one bold move: an occupancy-rate hero (the single number
// that answers "how is the portfolio doing" faster than four separate
// boxes), on an indigo-to-saffron gradient with a faint mountain skyline --
// a nod to the Pamirs rather than a generic SaaS blob-gradient. Everything
// else on the page stays on the quiet slate system; the boldness lives here
// and nowhere else.
//
// The filters used to live in a separate plain gray title bar below this,
// and the KPI cards below *that* repeated numbers already shown here --
// three disconnected sections telling an overlapping story. Now there's
// one: filters are part of the hero chrome, and the cards further down
// only carry numbers that aren't already visible up here.
export function DashboardHero({
  t,
  loading,
  brandName,
  occupancyPct,
  totalUnits,
  availableCount,
  reservedCount,
  soldCount,
  paidRevenueLabel,
  buildings,
  selectedBuildingId,
  onBuildingChange,
  periodFilter,
  onPeriodChange,
}: {
  t: Dictionary;
  loading: boolean;
  brandName: string;
  occupancyPct: number;
  totalUnits: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  paidRevenueLabel: string;
  buildings: Building[];
  selectedBuildingId: string;
  onBuildingChange: (id: string) => void;
  periodFilter: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}) {
  return (
    <div className="hero-gradient relative overflow-hidden rounded-2xl px-6 py-8 text-white shadow-lg shadow-slate-900/10 sm:px-10 sm:py-10">
      {/* Mountain skyline signature, low-opacity so it stays atmosphere, not decoration. */}
      <svg
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-white/10 sm:h-36"
      >
        <path
          fill="currentColor"
          d="M0,160 L110,90 L200,140 L320,55 L430,120 L540,40 L650,110 L760,70 L860,130 L1000,85 L1000,200 L0,200 Z"
        />
      </svg>

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">
            {t.dashboard.hero.eyebrow}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBuildingId}
              onChange={(e) => onBuildingChange(e.target.value)}
              className={GLASS_SELECT}
            >
              <option style={{ color: "#0f172a" }} value="all">
                {t.dashboard.allBuildings}
              </option>
              {buildings.map((b) => (
                <option style={{ color: "#0f172a" }} key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={periodFilter}
              onChange={(e) => onPeriodChange(e.target.value as PeriodFilter)}
              className={GLASS_SELECT}
            >
              <option style={{ color: "#0f172a" }} value="all">
                {t.dashboard.periodAll}
              </option>
              <option style={{ color: "#0f172a" }} value="today">
                {t.dashboard.periodToday}
              </option>
              <option style={{ color: "#0f172a" }} value="month">
                {t.dashboard.periodMonth}
              </option>
              <option style={{ color: "#0f172a" }} value="year">
                {t.dashboard.periodYear}
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-fade-up flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{brandName}</h1>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-5xl font-bold tabular-nums sm:text-6xl">
                {loading ? "—" : `${occupancyPct}%`}
              </span>
              <span className="max-w-[10rem] text-sm leading-tight text-white/70">
                {t.dashboard.hero.occupancyLabel}
              </span>
            </div>

            {!loading && (
              <p className="text-sm text-white/70">
                {totalUnits} {t.dashboard.totalObjects.toLowerCase()} · {availableCount}{" "}
                {t.dashboard.available.toLowerCase()} · {reservedCount}{" "}
                {t.dashboard.reserved.toLowerCase()} · {soldCount}{" "}
                {t.dashboard.sold.toLowerCase()}
              </p>
            )}
          </div>

          <div
            className="animate-fade-up flex flex-wrap items-center gap-3"
            style={{ animationDelay: "80ms" }}
          >
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/60">
                {t.dashboard.paidRevenue}
              </p>
              <p className="mt-0.5 text-lg font-semibold">{loading ? "…" : paidRevenueLabel}</p>
            </div>
            <Link
              href="/buildings"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
            >
              {t.dashboard.hero.cta} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
