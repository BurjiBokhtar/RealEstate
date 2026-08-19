"use client";

import { useState } from "react";

export type RingDatum = {
  id: string;
  label: string;
  /** Units sold -- the arc the centre figure counts. */
  sold: number;
  /** Units held but not yet sold. */
  reserved: number;
  total: number;
};

/** Which band of a ring is being pointed at. */
export type RingSegment = "sold" | "reserved" | "free";

export type RingColors = Record<RingSegment, string>;

// One ring per building, side by side.
//
// The arcs carry the SAME colours a cell carries in the shakhmatka -- sold
// red, reserved amber, free green -- because that is the mapping everyone
// using this program already reads all day. A ring in the building's own
// colour was prettier, but it agreed with nothing the user actually works in.
//
// Hovering behaves like the area donut: the band under the cursor brightens,
// everything else fades back, and the middle of the ring switches from "how
// much is sold" to whatever is being pointed at. Hovering the legend does the
// same to that status across every building at once, which is the view that
// answers "where is there anything left".
//
// The highlight is brightness()/saturate() only, deliberately not
// drop-shadow(). A drop-shadow needs extra canvas around the shape to paint
// its blur into, so the browser expands the element's filter region past its
// own edges -- on a stroke this thin that expanded region can rasterize as a
// faint rectangular backing behind the ring, and the coloured blur itself
// softens the very colour it was meant to emphasise instead of keeping it
// crisp. brightness/saturate never need extra canvas, so neither artifact
// can appear.

const R = 26;
const C = 2 * Math.PI * R;

// Butt caps, not round. A rounded cap adds half the stroke width at each end,
// which on a 1% arc is most of the arc: three flats sold out of 355 drew as if
// it were a dozen.
function Arc({
  from,
  span,
  color,
  dim,
  lit,
  onEnter,
  onLeave,
}: {
  from: number;
  span: number;
  color: string;
  dim: boolean;
  lit: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
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
      opacity={dim ? 0.28 : 1}
      className="cursor-pointer transition-[opacity,filter] duration-200"
      style={{ filter: lit ? "brightness(1.15) saturate(1.5)" : undefined }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    />
  );
}

export function RingChart({
  data,
  colors,
  /** Set from the legend, so one status can be lit across every ring. */
  activeSegment = null,
}: {
  data: RingDatum[];
  colors: RingColors;
  activeSegment?: RingSegment | null;
}) {
  const [hover, setHover] = useState<{ id: string; segment: RingSegment } | null>(null);

  // A pointer on an arc beats the legend: it is the more specific thing to
  // have asked for.
  const segment = hover?.segment ?? activeSegment;

  return (
    <ul className="flex flex-wrap items-start gap-x-3 gap-y-4">
      {data.map((d) => {
        const free = Math.max(0, d.total - d.sold - d.reserved);
        const frac = (n: number) => (d.total > 0 ? n / d.total : 0);
        const soldFrac = frac(d.sold);
        const reservedFrac = frac(d.reserved);

        // What the middle says: the share sold, unless a band is being
        // pointed at, in which case it says that band.
        const shown =
          segment === "reserved"
            ? { value: d.reserved, fraction: reservedFrac }
            : segment === "free"
              ? { value: free, fraction: frac(free) }
              : { value: d.sold, fraction: soldFrac };

        // Every ring dims, including one that has none of the pointed-at
        // band -- a building with nothing sold fading almost away while
        // "Фурӯхта шуд" is hovered IS the answer to "who has sold nothing".
        const band = (s: RingSegment) => ({
          dim: segment !== null && segment !== s,
          lit: segment === s,
          onEnter: () => setHover({ id: d.id, segment: s }),
          onLeave: () => setHover(null),
        });

        return (
          <li
            key={d.id}
            className="flex min-w-0 flex-1 basis-[96px] flex-col items-center"
            title={`${d.label} — ${d.sold}/${d.total}`}
          >
            {/* Grows with the card rather than sitting at a fixed 76px. The
                card shares a row with the area donut and stretches to its
                height, so a fixed ring left 90px of slack above and below on
                a wide screen; letting it scale spends that on legibility. */}
            <svg viewBox="0 0 68 68" className="w-full max-w-[124px]">
              {/* Three arcs sharing the ring, none of them overlapping.
                  Free used to be a full circle drawn underneath, with sold/
                  reserved painted over their own share of it -- which meant
                  a dimmed (low-opacity) red or amber arc let the green
                  circle sitting behind it show through, so "dimmed red"
                  actually rendered as a muddy green-red blend instead of a
                  faded red. As its own arc covering only its own share,
                  dimming fades it toward the white card behind the whole
                  ring instead of toward a different colour underneath. */}
              <Arc from={0} span={soldFrac} color={colors.sold} {...band("sold")} />
              <Arc
                from={soldFrac}
                span={reservedFrac}
                color={colors.reserved}
                {...band("reserved")}
              />
              <Arc
                from={soldFrac + reservedFrac}
                span={frac(free)}
                color={colors.free}
                {...band("free")}
              />
              <text
                x="34"
                y="38"
                textAnchor="middle"
                className="fill-slate-900 text-[14px] font-semibold tabular-nums"
              >
                {Math.round(shown.fraction * 100)}%
              </text>
            </svg>
            <p className="mt-2 w-full truncate text-center text-[11.5px] text-slate-600">
              {d.label}
            </p>
            <p className="text-center text-[10px] tabular-nums text-slate-400">
              {shown.value}/{d.total}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
