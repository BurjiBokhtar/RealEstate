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
