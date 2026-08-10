"use client";

import { useEffect, useRef, useState } from "react";
import type { BuildingHue } from "./palette";

export type TreemapDatum = {
  id: string;
  label: string;
  value: number;
  hue: BuildingHue;
};

type Rect = { x: number; y: number; w: number; h: number; d: TreemapDatum };

// Tiles whose AREA is the share of the total.
//
// A ranked bar answers "who earned most"; this answers "how much of the money
// came from where", which on a dashboard is the more useful question -- two
// buildings filling two thirds of the box is a fact you can see without
// reading a single number.
//
// Laid out by recursive halving: the list, already sorted, is cut into two
// groups of roughly equal weight and the box is cut in the same proportion,
// always across its longer side. That keeps tiles near square without the full
// squarify algorithm; with a handful of buildings the difference is invisible.
function layout(items: TreemapDatum[], x: number, y: number, w: number, h: number): Rect[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ x, y, w, h, d: items[0] }];

  const total = items.reduce((s, i) => s + i.value, 0);
  // Split where the running sum first reaches half the weight, but never so
  // that one side ends up empty.
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].value;
    cut = i + 1;
    if (acc >= total / 2) break;
  }
  const headWeight = items.slice(0, cut).reduce((s, i) => s + i.value, 0);
  const frac = total > 0 ? headWeight / total : 0.5;

  if (w >= h) {
    const cw = w * frac;
    return [
      ...layout(items.slice(0, cut), x, y, cw, h),
      ...layout(items.slice(cut), x + cw, y, w - cw, h),
    ];
  }
  const ch = h * frac;
  return [
    ...layout(items.slice(0, cut), x, y, w, ch),
    ...layout(items.slice(cut), x, y + ch, w, h - ch),
  ];
}

export function TreemapChart({
  data,
  height = 168,
  formatValue,
}: {
  data: TreemapDatum[];
  height?: number;
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // The split always cuts across the longer side, so the layout has to work in
  // the box's REAL proportions. Laid out in a square coordinate space it read
  // a 590x168 card as square and cut it vertically first, turning the two
  // biggest buildings into 6:1 strips -- correct areas, unreadable shapes.
  // Width is measured; height is fixed by the prop.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;

  // Laid out in pixels once the width is known, then expressed as percentages
  // so the tiles still reflow smoothly while the card resizes. Before the first
  // measurement a 3:1 card is the assumption -- roughly what half a dashboard
  // row is -- so the very first paint is already close.
  const w = width || height * 3;
  const rects = layout(rows, 0, 0, w, height);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {rects.map(({ x, y, w: rw, h: rh, d }) => {
        const px = (v: number) => (v / w) * 100;
        const py = (v: number) => (v / height) * 100;
        const dim = hover !== null && hover !== d.id;
        // A sliver cannot hold text. Rather than print a clipped fragment of a
        // building's name, small tiles carry it in the tooltip only.
        const roomForName = rw > 78 && rh > 34;
        const roomForValue = rw > 130 && rh > 56;
        return (
          <div
            key={d.id}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            title={`${d.label} — ${formatValue(d.value)} · ${Math.round((d.value / total) * 100)}%`}
            className="absolute overflow-hidden rounded-md p-2 transition-opacity"
            style={{
              left: `${px(x)}%`,
              top: `${py(y)}%`,
              width: `calc(${px(rw)}% - 3px)`,
              height: `calc(${py(rh)}% - 3px)`,
              background: d.hue.solid,
              opacity: dim ? 0.35 : 1,
            }}
          >
            {roomForName && (
              <p className="truncate text-[11px] font-medium leading-tight text-white/85">
                {d.label}
              </p>
            )}
            {roomForValue && (
              <p className="mt-0.5 truncate text-[12px] font-semibold tabular-nums text-white">
                {formatValue(d.value)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
