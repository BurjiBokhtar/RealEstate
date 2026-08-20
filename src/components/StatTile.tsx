"use client";

import type { ReactNode } from "react";

// One "state at a glance" tile: label, then the number -- large and bold,
// because this is the number a manager glances at from across the desk, not
// something they lean in to read. Shared by the client profile page and the
// contract cash-desk, which used to hand-roll near-identical versions of
// the same tile (same classes, subtly different each time).
export function StatTile({
  label,
  value,
  tone,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  tone: string;
  delay?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-up rounded-xl border border-[var(--border-c)] bg-[var(--surface-1)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="text-[11px] uppercase tracking-wide text-[var(--ink-5)]">{label}</p>
      <div className={`mt-1.5 text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export type StatTileData = { label: string; value: ReactNode; tone: string };

// A row of tiles, each staggered in on mount (50ms apart) -- the same
// rhythm everywhere this pattern appears.
export function StatTileRow({ tiles }: { tiles: StatTileData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile, i) => (
        <StatTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          tone={tile.tone}
          delay={i * 50}
        />
      ))}
    </div>
  );
}
