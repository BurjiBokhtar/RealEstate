"use client";

import { useState } from "react";

export function Accordion({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Same chip language as the settings nav cards above this -- so a
      section reads as "one of these" at a glance instead of the nav
      cards being the only place on the page that bothered with one. */
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--hover-c)]"
      >
        <span className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--wash-amber)] text-[var(--wash-amber-ink)]">
              {icon}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-[var(--ink-2)]">{title}</span>
        </span>
        <span
          className={`text-[var(--ink-5)] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-[var(--border-c2)] px-4 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
