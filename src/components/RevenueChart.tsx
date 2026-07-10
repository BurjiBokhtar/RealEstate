"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/currency";

export type RevenueMonth = { month: string; tjs: number; usd: number };

export function RevenueChart({ data }: { data: RevenueMonth[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => Math.max(d.tjs, d.usd)), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> TJS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> USD
        </span>
      </div>

      <div className="flex items-end gap-3" style={{ height: 160 }}>
        {data.map((d) => {
          const key = d.month;
          const isHovered = hovered === key;
          return (
            <div
              key={key}
              className="group relative flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div
                  className={`w-full max-w-4 rounded-t transition-all duration-200 ${
                    isHovered ? "bg-sky-500 shadow-md" : "bg-sky-600"
                  }`}
                  style={{
                    height: `${(d.tjs / max) * 100}%`,
                    minHeight: d.tjs > 0 ? 3 : 0,
                    transform: isHovered ? "scaleY(1.03)" : undefined,
                    transformOrigin: "bottom",
                  }}
                />
                <div
                  className={`w-full max-w-4 rounded-t transition-all duration-200 ${
                    isHovered ? "bg-violet-500 shadow-md" : "bg-violet-600"
                  }`}
                  style={{
                    height: `${(d.usd / max) * 100}%`,
                    minHeight: d.usd > 0 ? 3 : 0,
                    transform: isHovered ? "scaleY(1.03)" : undefined,
                    transformOrigin: "bottom",
                  }}
                />
              </div>
              <span
                className={`text-[10px] transition-colors ${isHovered ? "font-semibold text-slate-700" : "text-slate-400"}`}
              >
                {d.month}
              </span>

              <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg group-hover:visible">
                <p className="text-sky-700">{formatCurrency(d.tjs, "TJS")}</p>
                <p className="text-violet-700">{formatCurrency(d.usd, "USD")}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
