export const CURRENCIES = ["TJS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Built once. Constructing an Intl.NumberFormat is surprisingly expensive --
// it loads locale data every time -- and this function is called per cell in
// the shakhmatka and per row in every money table, so a fresh formatter on
// each call was pure overhead on exactly the busiest screens.
const nf = new Intl.NumberFormat("ru-RU");

export function formatCurrency(amount: number | null, currency: Currency): string {
  if (amount === null) return "—";
  return nf.format(amount) + " " + currency;
}
