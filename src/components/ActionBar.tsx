"use client";

import type { ReactNode } from "react";

// One row, everything on the right.
//
// Action rows were previously built ad hoc with `justify-between`: the icon
// segment pinned left, the text buttons pinned right, and a stretch of empty
// space in between. On a wide screen the two halves ended up far enough apart
// to read as unrelated controls, and the eye had to cross the whole card to
// find them. Collecting them into a single right-aligned cluster gives every
// screen the same place to look.
//
// Wraps to the right on narrow screens rather than stacking to the left, so
// the grouping survives on a phone.
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  );
}

// A text button sized to sit level with the icon segments next to it (h-9),
// so a mixed row of icons and words lines up on one baseline.
export function ActionButton({
  onClick,
  children,
  tone = "quiet",
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "quiet" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-9 shrink-0 rounded-lg border px-3.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${
        tone === "danger"
          ? "border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
