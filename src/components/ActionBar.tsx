"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

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
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

// Toolbars sit in two kinds of place: page headers, where they are the main
// controls and can be full size, and inside cards and table rows, where a
// full-size button would tower over the text beside it. The toolbar declares
// the size once and every icon in it follows, so a row can't come out with
// mismatched buttons.
export type ToolbarSize = "sm" | "md";

const SizeContext = createContext<ToolbarSize>("md");

export const SIZE_CLASSES: Record<ToolbarSize, { button: string; icon: string }> = {
  sm: { button: "h-8 w-8", icon: "[&_svg]:h-[16px] [&_svg]:w-[16px]" },
  md: { button: "h-10 w-10", icon: "[&_svg]:h-[19px] [&_svg]:w-[19px]" },
};

// The bordered container that turns a handful of icon buttons into one
// toolbar. Deliberately NOT `overflow-hidden`: the tooltips below each icon
// have to be able to escape it. Rounding lives on the individual buttons
// instead, so hover backgrounds still look right at the ends.
export function IconToolbar({
  children,
  size = "md",
}: {
  children: ReactNode;
  size?: ToolbarSize;
}) {
  return (
    <SizeContext.Provider value={size}>
      <div
        className={`inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white ${
          size === "sm" ? "gap-0.5 p-0.5" : "gap-1 p-1"
        }`}
      >
        {children}
      </div>
    </SizeContext.Provider>
  );
}

// One icon-only action with its name on hover.
//
// The label is not decoration: an icon on its own is a guess until you click
// it. It is exposed three ways -- a styled tooltip for the mouse, `title` for
// the browser's own tooltip and touch long-press, and `aria-label` for screen
// readers -- because an icon button with no accessible name is just an
// unlabelled square to anyone not using their eyes.
export function IconAction({
  label,
  icon,
  onClick,
  href,
  active = false,
  tone = "quiet",
  disabled = false,
  size,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Toggled-on look, for actions that hold a state (e.g. edit mode). */
  active?: boolean;
  tone?: "quiet" | "brand" | "danger";
  disabled?: boolean;
  /** Overrides the size inherited from the surrounding IconToolbar. */
  size?: ToolbarSize;
}) {
  const inherited = useContext(SizeContext);
  const s = SIZE_CLASSES[size ?? inherited];
  // The `[&_svg]` rule sizes the icon from here rather than trusting each call
  // site to pass the same h-4 w-4 -- one place to change, and a new toolbar
  // can't quietly come out a different size.
  //
  // The lift on hover (-translate-y-0.5 + a shadow) is what makes an icon feel
  // pressable at all: without a label there is otherwise nothing that answers
  // the pointer until it's already been clicked.
  const base =
    `flex ${s.button} ${s.icon} shrink-0 items-center justify-center rounded-md transition-all duration-150 ` +
    "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 " +
    "disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none";
  const look = active
    ? "bg-amber-100 text-amber-800"
    : tone === "brand"
      ? // --brand, not --brand-strong: the "strong" variant is near-black in
        // every theme (#1c1a3a, #06302b, #0c1e4a...), so a themed button made
        // of it just looked black. --brand is the shade that actually carries
        // the company's colour.
        "bg-brand text-white hover:brightness-110"
      : tone === "danger"
        ? "text-rose-600 hover:bg-rose-50"
        : "text-slate-600 hover:bg-slate-100";

  const inner = <span className="pointer-events-none">{icon}</span>;

  return (
    <span className="group/tip relative inline-flex">
      {href ? (
        <Link href={href} title={label} aria-label={label} className={`${base} ${look}`}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          title={label}
          aria-label={label}
          className={`${base} ${look}`}
        >
          {inner}
        </button>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
