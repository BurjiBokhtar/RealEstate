export function formatDualCurrency(amount: number | null, usdRate: number): string {
  if (amount === null) return "—";
  const tjs = new Intl.NumberFormat("ru-RU").format(amount) + " TJS";
  if (!usdRate) return tjs;
  const usd = amount / usdRate;
  const usdFormatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(usd);
  return `${tjs} · $${usdFormatted}`;
}
