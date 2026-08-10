// The chart palette: saturated, high-contrast hues that read clearly as
// separate categories, tuned for a WHITE card rather than a dark one.
//
// The reference design was on a dark panel, where light pastels glow. On white
// the same pastels turn to mush, so every hue here is a mid-tone (500/600
// range) -- vivid enough to carry meaning, dark enough to hold an edge against
// the card. Each entry keeps the pair the bars/areas are drawn with: `to` is
// the solid body colour, `from` the lighter top of the gradient.
export type ChartHue = { from: string; to: string; solid: string };

export const CHART_HUES: ChartHue[] = [
  { from: "#4ade80", to: "#16a34a", solid: "#22c55e" }, // emerald
  { from: "#60a5fa", to: "#2563eb", solid: "#3b82f6" }, // blue
  { from: "#fbbf24", to: "#d97706", solid: "#f59e0b" }, // amber
  { from: "#f87171", to: "#dc2626", solid: "#ef4444" }, // red
  { from: "#c084fc", to: "#9333ea", solid: "#a855f7" }, // violet
  { from: "#22d3ee", to: "#0891b2", solid: "#06b6d4" }, // cyan
  { from: "#fb923c", to: "#ea580c", solid: "#f97316" }, // orange
  { from: "#f472b6", to: "#db2777", solid: "#ec4899" }, // pink
];

export function hueAt(i: number): ChartHue {
  return CHART_HUES[i % CHART_HUES.length];
}

// Unit statuses keep meaning-carrying colours rather than palette order:
// green = free to sell, amber = held, red = gone, and the two rare states
// stay quiet so they never dominate a bar.
export const STATUS_HUES: Record<string, ChartHue> = {
  available: { from: "#4ade80", to: "#16a34a", solid: "#22c55e" },
  reserved: { from: "#fbbf24", to: "#d97706", solid: "#f59e0b" },
  sold: { from: "#f87171", to: "#dc2626", solid: "#ef4444" },
  rented: { from: "#22d3ee", to: "#0891b2", solid: "#06b6d4" },
  in_progress: { from: "#c084fc", to: "#9333ea", solid: "#a855f7" },
};

// The two currencies get colours from DIFFERENT hue families, fixed rather
// than theme-derived.
//
// They used to be --brand and --hero-3. On the emerald theme that is #0f766e
// against #6ee7b7 -- teal and mint, both unmistakably green, so a two-line
// revenue chart read as one colour and nobody could tell TJS from USD. A
// legend does not rescue a chart whose series look identical. Following the
// theme is worth less here than being able to read the chart at all.
export const CURRENCY_HUES: Record<"TJS" | "USD", ChartHue> = {
  TJS: { from: "#4ade80", to: "#16a34a", solid: "#22c55e" }, // green
  USD: { from: "#60a5fa", to: "#1d4ed8", solid: "#3b82f6" }, // blue
};

export const AXIS_TEXT = "fill-slate-400 text-[10px] tabular-nums";
export const GRID_STROKE = "#f1f5f9";

const nf = new Intl.NumberFormat("ru-RU");

// Axis/label money: 5 720 000 -> "5,7 млн". Below a million the full
// space-grouped number is short enough and unambiguous in both languages.
export function compactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  return nf.format(Math.round(n));
}

// Round a max up to a friendly axis top (so gridlines land on 2/5/10 steps
// instead of 17.3) and return the tick values with it.
export function axisTicks(max: number, steps = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const top = step * steps;
  return { top, ticks: Array.from({ length: steps + 1 }, (_, i) => step * i) };
}

// A colour per BUILDING, and the same colour for that building in every chart
// that mentions it.
//
// The revenue ranking used to take its colours from the row's position --
// first row green, second blue, third amber, fourth red. Colour therefore
// carried no information at all, and worse, it lied twice over: red is
// "продано" in the occupancy legend next to it, so the building EARNING THE
// LEAST looked like a warning, and a building changed colour the moment the
// ranking reordered. Keyed to the building instead, the same colour means the
// same place on both cards, and following one building across them is a
// glance rather than a search.
export type BuildingHue = ChartHue & { soft: string };

export const BUILDING_HUES: BuildingHue[] = [
  { from: "#2dd4bf", to: "#0d9488", solid: "#0d9488", soft: "#99f6e4" }, // teal
  { from: "#818cf8", to: "#4f46e5", solid: "#4f46e5", soft: "#c7d2fe" }, // indigo
  { from: "#fbbf24", to: "#d97706", solid: "#d97706", soft: "#fde68a" }, // amber
  { from: "#c084fc", to: "#7c3aed", solid: "#7c3aed", soft: "#ddd6fe" }, // violet
  { from: "#22d3ee", to: "#0891b2", solid: "#0891b2", soft: "#a5f3fc" }, // cyan
  { from: "#fb7185", to: "#e11d48", solid: "#e11d48", soft: "#fecdd3" }, // rose
  { from: "#a3e635", to: "#4d7c0f", solid: "#4d7c0f", soft: "#d9f99d" }, // lime
  { from: "#fb923c", to: "#ea580c", solid: "#ea580c", soft: "#fed7aa" }, // orange
];

/**
 * Stable building id → colour.
 *
 * Assigned over the ids SORTED, not over the order they arrive in. The two
 * charts sort their rows differently (one by occupancy, one by revenue, and
 * revenue again per currency), so an index-based colour would have given the
 * same building a different colour in each -- which is exactly the problem
 * this replaces.
 */
export function buildingHues(ids: string[]): Map<string, BuildingHue> {
  const map = new Map<string, BuildingHue>();
  [...new Set(ids)]
    .sort()
    .forEach((id, i) => map.set(id, BUILDING_HUES[i % BUILDING_HUES.length]));
  return map;
}
