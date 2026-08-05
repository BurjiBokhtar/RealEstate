"use client";

import { useEffect, useState } from "react";
import type { ObjectStatus } from "@/lib/objects/types";

// Occupancy segment shade: the same status colours as the shakhmatka grid
// (available = green, reserved = yellow, sold = red/rose, …) instead of
// tints of the theme brand colour -- so a unit's colour here means the same
// thing it means everywhere else in the app, regardless of which hero theme
// is active.
const SHADES: Record<ObjectStatus, { background: string; color: string }> = {
  available: { background: "#34d399", color: "#065f46" }, // emerald-400 / emerald-900
  reserved: { background: "#fbbf24", color: "#78350f" }, // amber-400 / amber-900
  sold: { background: "#fb7185", color: "#ffffff" }, // rose-400
  rented: { background: "#38bdf8", color: "#ffffff" }, // sky-400
  in_progress: { background: "#a78bfa", color: "#ffffff" }, // violet-400
};

export function occShade(status: ObjectStatus): { background: string; color: string } {
  return SHADES[status] ?? { background: "#94a3b8", color: "#ffffff" };
}

// A stacked occupancy bar, "glow" style to match the revenue chart: a pill
// track with an inset shadow for depth, segments filled with a light-to-rich
// vertical gradient of their status colour instead of a flat tint. Segments
// grow in on mount instead of appearing at full width, a 2px surface gap
// separates touching segments (border-box, so it eats into each segment's
// own width rather than pushing the total past 100%), and each segment
// carries its own hover tooltip -- replacing the browser's plain `title`
// popup, which is slow to appear and impossible to style, with the same
// tooltip language as the revenue chart.
export function OccupancyBar({
  counts,
  total,
  labels,
}: {
  counts: Record<ObjectStatus, number>;
  total: number;
  labels: Record<ObjectStatus, string>;
}) {
  const [hovered, setHovered] = useState<ObjectStatus | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const statuses = (Object.keys(counts) as ObjectStatus[]).filter((s) => counts[s] > 0);

  return (
    <div
      className="flex h-7 w-full overflow-hidden rounded-full bg-slate-100 text-[11px] font-bold"
      style={{ boxShadow: "inset 0 1px 3px rgb(0 0 0 / 0.08)" }}
    >
      {statuses.map((status, i) => {
        const pct = total ? (counts[status] / total) * 100 : 0;
        const shade = occShade(status);
        const isH = hovered === status;
        return (
          <div
            key={status}
            className="group relative flex items-center justify-center transition-[width,filter] duration-700 ease-out"
            style={{
              width: `${mounted ? pct : 0}%`,
              background: `linear-gradient(180deg, color-mix(in srgb, ${shade.background} 55%, white), ${shade.background})`,
              color: shade.color,
              borderRight: i < statuses.length - 1 ? "2px solid white" : undefined,
              filter: isH ? "brightness(0.96)" : undefined,
            }}
            onMouseEnter={() => setHovered(status)}
            onMouseLeave={() => setHovered(null)}
          >
            {pct > 7 ? counts[status] : ""}

            {/* Value leads (bold ink), label follows, dot carries identity --
                same tooltip language as RevenueChart. */}
            <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs normal-case shadow-xl group-hover:visible">
              <p className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: shade.background }}
                />
                <span className="font-normal text-slate-400">{labels[status]}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-800">
                  {counts[status]}
                </span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
