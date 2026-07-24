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
      className="group inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow active:scale-95"
    >
      <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
        ←
      </span>
      {children}
    </Link>
  );
}
