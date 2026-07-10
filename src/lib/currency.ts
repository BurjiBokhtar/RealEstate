export const CURRENCIES = ["TJS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function formatCurrency(amount: number | null, currency: Currency): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("ru-RU").format(amount) + " " + currency;
}
