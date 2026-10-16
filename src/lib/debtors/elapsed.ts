// How long ago a stored date was, for the Debtors list.
//
// "Last payment: 8 months 3 days ago" has to survive the obvious traps:
//
//  - Dates arrive as YYYY-MM-DD with no time zone. `new Date("2026-02-01")` is
//    midnight UTC, which in a time zone west of UTC is still January 31 -- and
//    subtracting it from "now" then gives a count that is off by one day for
//    half the day. Both ends are therefore reduced to a plain calendar date and
//    compared as UTC midnights, so the answer is whole days and never drifts.
//  - A month is not 30 days. The gap is counted in real calendar months from the
//    date, so "1 month" means the same day-of-month one month on; the leftover is
//    days. When the target month is shorter than the day-of-month (Jan 31 + one
//    month) the anchor is clamped to that month's last day instead of rolling
//    into the next one.

const MS_PER_DAY = 86_400_000;

export type Elapsed = {
  years: number;
  months: number;
  days: number;
  /** The same gap in whole days -- what sorting and colour thresholds use. */
  totalDays: number;
};

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  // Reject 2026-02-31 and friends: they round-trip to a different day.
  const check = new Date(Date.UTC(y, m, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m || check.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Last day of month `m` (0-based) of year `y`. */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/**
 * Calendar gap between `iso` and `now`, or null when `iso` is missing or not a
 * real date. A date in the future reads as zero rather than a negative gap.
 */
export function elapsedSince(iso: string | null | undefined, now: Date = new Date()): Elapsed | null {
  if (!iso) return null;
  const from = parseIso(iso);
  if (!from) return null;

  const ty = now.getFullYear();
  const tm = now.getMonth();
  const td = now.getDate();

  const fromUtc = Date.UTC(from.y, from.m, from.d);
  const nowUtc = Date.UTC(ty, tm, td);
  if (nowUtc <= fromUtc) return { years: 0, months: 0, days: 0, totalDays: 0 };

  const totalDays = Math.round((nowUtc - fromUtc) / MS_PER_DAY);

  // The date `months` calendar months after the start, with the day-of-month
  // clamped to that month's length (Jan 31 + 1 month = Feb 28).
  const anchorDay = (months: number) => {
    const idx = from.m + months;
    const y = from.y + Math.floor(idx / 12);
    const m = ((idx % 12) + 12) % 12;
    return { y, m, d: Math.min(from.d, daysInMonth(y, m)) };
  };
  // Start from the raw month difference and step back until the anchor is not
  // after today -- i.e. drop the last month if it has not fully elapsed yet.
  let totalMonths = (ty - from.y) * 12 + (tm - from.m);
  while (totalMonths > 0) {
    const a = anchorDay(totalMonths);
    if (Date.UTC(a.y, a.m, a.d) <= nowUtc) break;
    totalMonths -= 1;
  }
  if (totalMonths < 0) totalMonths = 0;

  const a = anchorDay(totalMonths);
  const days = Math.round((nowUtc - Date.UTC(a.y, a.m, a.d)) / MS_PER_DAY);

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
    totalDays,
  };
}

export type ElapsedWords = {
  years: string;
  months: string;
  days: string;
  today: string;
};

/**
 * "1 г. 2 мес." / "8 мес. 3 дн." / "12 дн." / "сегодня".
 *
 * Only the two largest units are shown: "1 год 2 месяца 5 дней" is accurate and
 * unreadable in a table cell, and nobody reading "1 г. 2 мес." needs the days.
 */
export function formatElapsed(e: Elapsed, words: ElapsedWords): string {
  if (e.totalDays === 0) return words.today;
  const parts: string[] = [];
  if (e.years > 0) {
    parts.push(`${e.years} ${words.years}`);
    if (e.months > 0) parts.push(`${e.months} ${words.months}`);
  } else if (e.months > 0) {
    parts.push(`${e.months} ${words.months}`);
    if (e.days > 0) parts.push(`${e.days} ${words.days}`);
  } else {
    parts.push(`${e.days} ${words.days}`);
  }
  return parts.join(" ");
}
