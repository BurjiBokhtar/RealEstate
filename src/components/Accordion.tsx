"use client";

import { useState } from "react";

export function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span
          className={`text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
