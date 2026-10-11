/**
 * Civil-date arithmetic.
 *
 * The whole streak system rests on one distinction: a *civil date* ("2026-08-31")
 * is a label on a calendar, not a point in time. A teen in Lagos who checks in
 * at 00:30 has already started a new day while a UTC server still says
 * yesterday. Getting that wrong silently breaks someone's 40-day streak, and
 * they have no way to tell you it happened.
 *
 * So: convert instant -> civil date exactly once, at the edge, using the teen's
 * own IANA zone. Everything downstream is string-and-integer arithmetic on the
 * civil calendar, which no DST transition can perturb.
 */

/** `YYYY-MM-DD`. */
export type LocalDate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Cached because constructing a DateTimeFormat is ~100x the cost of using one. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      era: "short",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/**
 * The civil date an instant falls on, in `timeZone`.
 *
 * Built from formatToParts rather than a formatted string so no locale can slip
 * in a different digit system, ordering, or separator.
 *
 * @throws RangeError if the zone is unknown or the instant is invalid.
 */
export function localDateOf(instant: Date | string | number, timeZone: string): LocalDate {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError(`invalid instant: ${String(instant)}`);

  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(get("year"));
  const month = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");
  if (!Number.isFinite(year)) throw new RangeError(`could not read a date in zone ${timeZone}`);

  // Pre-1 CE would break the padding assumption. Irrelevant in practice, loud if hit.
  if (get("era") === "BC") throw new RangeError("dates before 1 CE are not supported");
  return `${String(year).padStart(4, "0")}-${month}-${day}`;
}

/** Parses a civil date into its numeric parts. @throws RangeError when malformed. */
export function parseLocalDate(d: LocalDate): { year: number; month: number; day: number } {
  if (!DATE_RE.test(d)) throw new RangeError(`expected YYYY-MM-DD, got "${d}"`);
  const [year, month, day] = d.split("-").map(Number) as [number, number, number];
  if (month < 1 || month > 12) throw new RangeError(`month out of range in "${d}"`);
  if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())
    throw new RangeError(`day out of range in "${d}"`);
  return { year, month, day };
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * A civil date as a UTC-midnight epoch. Only ever used as an ordinal for day
 * arithmetic - never rendered, never treated as a real instant.
 */
function ordinal(d: LocalDate): number {
  const { year, month, day } = parseLocalDate(d);
  return Date.UTC(year, month - 1, day);
}

function fromOrdinal(ms: number): LocalDate {
  const dt = new Date(ms);
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Calendar-day shift. DST-immune because it never touches a real instant. */
export function addDays(d: LocalDate, n: number): LocalDate {
  if (!Number.isInteger(n)) throw new RangeError(`addDays needs an integer, got ${n}`);
  return fromOrdinal(ordinal(d) + n * MS_PER_DAY);
}

/** Whole calendar days from `a` to `b`. Negative when `b` precedes `a`. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((ordinal(b) - ordinal(a)) / MS_PER_DAY);
}

export const compareDates = (a: LocalDate, b: LocalDate): number => ordinal(a) - ordinal(b);
export const isBefore = (a: LocalDate, b: LocalDate): boolean => ordinal(a) < ordinal(b);
export const isAfter = (a: LocalDate, b: LocalDate): boolean => ordinal(a) > ordinal(b);

/** Every civil date from `from` to `to`, inclusive. Empty when `to` precedes `from`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const span = diffDays(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addDays(from, i));
}

/** The inclusive `days`-long window ending on `end`. `days: 14` => 13 days back. */
export function windowStart(end: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`window needs >=1 day, got ${days}`);
  return addDays(end, -(days - 1));
}

export function isWithinWindow(d: LocalDate, end: LocalDate, days: number): boolean {
  const start = windowStart(end, days);
  return !isBefore(d, start) && !isAfter(d, end);
}

/** Sorted ascending, duplicates removed. The canonical form for a set of days. */
export function uniqueSortedDates(dates: readonly LocalDate[]): LocalDate[] {
  return [...new Set(dates)].sort(compareDates);
}
