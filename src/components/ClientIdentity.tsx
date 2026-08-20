"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const AVATAR_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-12 w-12 text-lg",
};

const NAME_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-xl",
};

// The one "who is this" block: gradient avatar (first letter of the name) +
// name + phone/source. Used identically in the client profile page and in
// the contract cash-desk sidebar -- previously each hand-rolled its own
// near-identical version, so the same person looked like two different
// pieces of UI depending on which screen you were on. `href` turns the name
// into a link back to the client's own page (for the cash-desk's mini
// card); leave it out on the client page itself, where the name is already
// the page title.
export function ClientIdentity({
  name,
  phone,
  source,
  href,
  size = "md",
  actions,
}: {
  name: string;
  phone?: string | null;
  source?: string | null;
  href?: string;
  size?: "sm" | "md" | "lg";
  actions?: ReactNode;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const subline = [phone, source].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={`hero-gradient flex ${AVATAR_SIZE[size]} shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white ring-offset-2 ring-offset-slate-50`}
        >
          {initial}
        </span>
        <div className="min-w-0">
          {href ? (
            <Link
              href={href}
              className={`-mx-1 block truncate rounded px-1 font-semibold leading-tight text-slate-900 transition-colors hover:bg-brand-soft hover:text-brand ${NAME_SIZE[size]}`}
            >
              {name}
            </Link>
          ) : (
            <h1 className={`truncate font-semibold leading-tight ${NAME_SIZE[size]}`}>{name}</h1>
          )}
          {subline && <p className="mt-0.5 truncate text-sm text-slate-400">{subline}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
