"use client";

import { useState } from "react";


export type RingDatum = {
  id: string;
  label: string;
  /** Units sold -- the solid arc, and the figure in the middle. */
  sold: number;
  /** Units held but not yet sold -- the pale arc that continues it. */
  reserved: number;
  total: number;
};

// One ring per building, side by side.
//
// The arcs carry the SAME colours a cell carries in the shakhmatka -- sold
// red, reserved amber, free green -- because that is the mapping everyone
// using this program already reads all day. A ring in the building’s own
// colour was prettier and made the two dashboard cards agree with each
// other, but it agreed with nothing the user actually works in, and a chart
// nobody can decode without a legend is not worth the tidiness.
//
// Free stays the pale shade rather than the full green: it is the part that
// has NOT happened yet, and at full strength an empty building read as a
// solid green success.

const R = 26;
const C = 2 * Math.PI * R;

// Butt caps, not round. A rounded cap adds half the stroke width at each end,
// which on a 1% arc is most of the arc: three flats sold out of 355 drew as if
// it were a dozen.
function Arc({ from, span, color }: { from: number; span: number; color: string }) {
  if (span <= 0) return null;
  return (
    <circle
      cx="34"
      cy="34"
      r={R}
      fill="none"
      stroke={color}
      strokeWidth="9"
      strokeDasharray={`${C * span} ${C * (1 - span)}`}
      transform={`rotate(${-90 + from * 360} 34 34)`}
    />
  );
}

export type RingColors = { sold: string; reserved: string; free: string };

export function RingChart({ data, colors }: { data: RingDatum[]; colors: RingColors }) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <ul className="flex flex-wrap items-start gap-x-3 gap-y-4">
      {data.map((d) => {
        const soldFrac = d.total > 0 ? d.sold / d.total : 0;
        const reservedFrac = d.total > 0 ? d.reserved / d.total : 0;
        const pct = Math.round(soldFrac * 100);
        const dim = hover !== null && hover !== d.id;
        return (
          <li
            key={d.id}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            className="flex min-w-0 flex-1 basis-[96px] flex-col items-center transition-opacity"
            style={{ opacity: dim ? 0.35 : 1 }}
            title={`${d.label} — ${d.sold}/${d.total}`}
          >
            {/* Grows with the card rather than sitting at a fixed 76px. The
                card shares a row with the area donut and stretches to its
                height, so a fixed ring left 90px of slack above and below on
                a wide screen; letting it scale spends that on legibility. */}
            <svg viewBox="0 0 68 68" className="w-full max-w-[124px]">
              {/* The track IS the free part -- it needs no arc of its own,
                  and drawing one would double-count the rounding. */}
              <circle cx="34" cy="34" r={R} fill="none" stroke={colors.free} strokeWidth="9" />
              <Arc from={soldFrac} span={reservedFrac} color={colors.reserved} />
              <Arc from={0} span={soldFrac} color={colors.sold} />
              <text
                x="34"
                y="38"
                textAnchor="middle"
                className="fill-slate-900 text-[14px] font-semibold tabular-nums"
              >
                {pct}%
              </text>
            </svg>
            <p className="mt-2 w-full truncate text-center text-[11.5px] text-slate-600">
              {d.label}
            </p>
            <p className="text-center text-[10px] tabular-nums text-slate-400">
              {d.sold}/{d.total}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
