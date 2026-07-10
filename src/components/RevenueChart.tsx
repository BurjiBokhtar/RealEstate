"use client";

import { formatDualCurrency } from "@/lib/currency";
import { useSettings } from "@/lib/settings/SettingsProvider";

export function RevenueChart({ data }: { data: Array<{ month: string; revenue: number }> }) {
  const { settings } = useSettings();
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((d) => {
        const heightPct = (d.revenue / max) * 100;
        return (
          <div key={d.month} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t bg-sky-600 transition-opacity group-hover:opacity-80"
                style={{ height: `${heightPct}%`, minHeight: d.revenue > 0 ? 3 : 0 }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{d.month}</span>

            <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-lg group-hover:visible">
              {formatDualCurrency(d.revenue, settings.usd_rate)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
