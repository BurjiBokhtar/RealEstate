// Bounds for every date field in the app.
//
// `<input type="date">` with no min/max accepts any year at all -- 0202, 20260,
// 1300 -- and the browser happily submits it. Postgres stores it, and from then
// on the row sorts and filters wrongly forever: a birth date of 0202 puts the
// client at the top of every "oldest first" list, and a contract signed in
// 20260 sits outside every reporting period, so it silently vanishes from
// revenue. Nothing downstream can repair a date that was never plausible.
//
// Two layers, because one is not enough: the min/max attributes give the
// browser's own picker sane limits, and isDateInRange() re-checks on submit --
// a value can still be typed or pasted past the attributes in several browsers,
// and the attributes are trivially removed in dev tools.

/** Nobody alive was born before this. */
export const MIN_BIRTH_DATE = "1920-01-01";

/** Business records don't predate the company by decades. */
export const MIN_BUSINESS_DATE = "2000-01-01";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Today plus n years, as YYYY-MM-DD -- the upper bound for planning dates. */
export function yearsAheadISO(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * True when `value` is a real calendar date inside [min, max]. An empty value
 * counts as valid: emptiness is handled by `required`, not by range.
 *
 * Compares the ISO strings rather than Date objects on purpose -- YYYY-MM-DD
 * sorts lexicographically, and `new Date("20260-01-01")` is not the trap-free
 * parse it looks like.
 */
export function isDateInRange(value: string, min: string, max: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Rejects 2026-02-31: the Date rolls it forward, so it no longer round-trips.
  if (d.toISOString().slice(0, 10) !== value) return false;
  return value >= min && value <= max;
}

/** Ready-made bounds for the common field kinds. */
export const DATE_BOUNDS = {
  /** A birth date: not before 1920, never in the future. */
  birth: () => ({ min: MIN_BIRTH_DATE, max: todayISO() }),
  /** Something that already happened (signed, paid). One day of slack for time zones. */
  past: () => ({ min: MIN_BUSINESS_DATE, max: todayISO() }),
  /** Something being planned (a task, an installment). */
  future: () => ({ min: MIN_BUSINESS_DATE, max: yearsAheadISO(20) }),
} as const;
