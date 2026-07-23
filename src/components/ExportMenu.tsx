"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// One "Экспорт" button that opens a small menu: Excel or PDF. The parent
// supplies the data lazily (fetched on demand) plus the headers, so the same
// menu serves clients, debtors, etc.
export function ExportMenu({
  getData,
  headers,
  filenameBase,
  title,
}: {
  // Returns the rows to export; async so the page can fetch the full set.
  getData: () => Promise<Array<Array<string | number | null | undefined>>>;
  headers: string[];
  filenameBase: string;
  title: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const run = async (format: "excel" | "pdf") => {
    setBusy(true);
    setOpen(false);
    const rows = await getData();
    const { exportExcel, exportPdf, todayStamp } = await import("@/lib/export/exportTable");
    if (format === "excel") {
      exportExcel(`${filenameBase}-${todayStamp()}`, headers, rows);
    } else {
      exportPdf(title, headers, rows);
    }
    setBusy(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50"
      >
        <span aria-hidden="true">⤓</span>
        {busy ? t.common.loading : t.exportMenu.export}
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => run("excel")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="text-emerald-600">▦</span> {t.exportMenu.excel}
          </button>
          <button
            type="button"
            onClick={() => run("pdf")}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="text-rose-600">▤</span> {t.exportMenu.pdf}
          </button>
        </div>
      )}
    </div>
  );
}
