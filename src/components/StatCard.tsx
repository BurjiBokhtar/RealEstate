"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// A modern metric card: a soft tinted icon chip, a quiet label, a big value,
// and an optional sub-line. Hover lifts it slightly. Renders as a link when
// `href` is given (e.g. the overdue card jumps to Debtors). One component for
// the whole dashboard row so every tile shares the same rhythm.
type Tone = "slate" | "emerald" | "rose" | "amber" | "indigo" | "plum";

const TONES: Record<Tone, { chip: string; value: string; ring: string }> = {
  slate: {
    chip: "bg-[var(--wash-slate)] text-[var(--wash-slate-ink)]",
    value: "text-[var(--ink-1)]",
    ring: "border-[var(--border-c)]",
  },
  emerald: {
    chip: "bg-[var(--wash-emerald)] text-[var(--wash-emerald-ink)]",
    value: "text-[var(--wash-emerald-ink)]",
    ring: "border-[var(--border-c)]",
  },
  rose: {
    chip: "bg-[var(--wash-rose)] text-[var(--wash-rose-ink)]",
    value: "text-[var(--wash-rose-ink)]",
    ring: "border-[var(--wash-rose-border)]",
  },
  amber: {
    chip: "bg-[var(--wash-amber)] text-[var(--wash-amber-ink)]",
    value: "text-[var(--wash-amber-ink)]",
    ring: "border-[var(--wash-amber-border)]",
  },
  indigo: {
    chip: "bg-[var(--wash-indigo)] text-[var(--wash-indigo-ink)]",
    value: "text-[var(--wash-indigo-ink)]",
    ring: "border-[var(--border-c)]",
  },
  // "plum" keeps its name (matches --brand's own family) but on the value
  // figure specifically -- not the chip -- it now follows --wash-plum-ink,
  // which is the one spot dark mode's fixed yellow accent shows up on a
  // dashboard number: "potential revenue" is the figure the tone was
  // invented for, and it reads as the accent both modes intend it to be.
  plum: {
    chip: "bg-[var(--wash-plum)] text-brand",
    value: "text-[var(--wash-plum-ink)]",
    ring: "border-[var(--border-c)]",
  },
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "slate",
  href,
  delay = 0,
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  href?: string;
  delay?: number;
  loading?: boolean;
}) {
  const c = TONES[tone];
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--ink-4)]">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.chip}`}>
          {icon}
        </span>
      </div>
      {/* Smaller on phones so long two-currency sums (e.g. "4 820 000 TJS")
          never run past the card edge; full size from sm up. */}
      <div
        className={`mt-2 min-w-0 break-words text-[19px] font-bold leading-tight tracking-tight sm:text-[26px] ${c.value}`}
      >
        {loading ? "…" : value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[var(--ink-5)]">{sub}</div>}
    </>
  );

  const cls = `animate-fade-up block overflow-hidden rounded-2xl border ${c.ring} bg-[var(--surface-1)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`;

  if (href) {
    return (
      <Link href={href} style={{ animationDelay: `${delay}ms` }} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <div style={{ animationDelay: `${delay}ms` }} className={cls}>
      {inner}
    </div>
  );
}

// Small inline outline icons for the cards (currentColor, one stroke weight).
export const StatIcons = {
  hammer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M14 6l4 4M3 21l7-7M13 5l6 6-2 2-6-6zM10 10l-6 6"/></svg>
  ),
  debt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h3M3 9h18"/></svg>
  ),
  area: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h4M17 3v4M9 21v-4M21 15h-4"/></svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M3 12l8-8h9v9l-8 8z"/><circle cx="16" cy="8" r="1.5"/></svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>
  ),
};
