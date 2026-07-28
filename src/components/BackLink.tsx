"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// One consistent, good-looking "back" control: a small pill button with an
// arrow that nudges left on hover. Replaces the faint grey text links that
// were scattered (and inconsistent, and sometimes missing) across pages.
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-medium text-slate-600 shadow-sm transition-all hover:-translate-x-0.5 hover:border-[color-mix(in_srgb,var(--brand)_30%,transparent)] hover:text-[var(--brand)] hover:shadow-md active:scale-95"
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-[var(--brand)] group-hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5"><path d="M15 5l-7 7 7 7" /></svg>
      </span>
      {children}
    </Link>
  );
}
