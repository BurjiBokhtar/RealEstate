"use client";

import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The dashboard's one bold move: an occupancy-rate hero (the single number
// that answers "how is the portfolio doing" faster than four separate
// boxes), on an indigo-to-saffron gradient with a faint mountain skyline --
// a nod to the Pamirs rather than a generic SaaS blob-gradient. Everything
// else on the page stays on the quiet slate system; the boldness lives here
// and nowhere else.
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

      <div className="relative flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-fade-up flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-amber-100/80">
            {t.dashboard.hero.eyebrow}
          </span>
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
  );
}
