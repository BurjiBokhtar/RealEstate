// A single place for "how do we show a date to a human" -- every screen
// that prints a due date, paid date, or signing date to a person (receipts,
// contracts, cash desk, payment history, debtors list) should read
// dd.mm.yyyy, never the raw yyyy-mm-dd the database stores. Native
// <input type="date"> fields are untouched by this -- browsers localize
// those on their own and they need the ISO value to work at all.
export function formatShortDate(
  iso: string | null | undefined,
  emptyFallback = "—"
): string {
  if (!iso) return emptyFallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
