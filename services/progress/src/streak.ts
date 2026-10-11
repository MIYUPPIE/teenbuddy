/**
 * Streak arithmetic.
 *
 * A streak is the one number in the app a teen will feel possessive about, so
 * the rules are deliberately forgiving at the edges and never surprising:
 *
 *   - The day you check in counts. Duplicate check-ins on one day count once.
 *   - The streak stays alive all of the day after your last check-in. It is
 *     "at risk", not broken, and the UI says so before it is too late.
 *   - It breaks only once a whole calendar day passes with nothing in it.
 *   - `longest` is the best run in the whole history and never goes down.
 */

import { addDays, compareDates, diffDays, isAfter, uniqueSortedDates, type LocalDate } from "./dates.ts";

export type Streak = {
  /** Days in the run ending today or yesterday. 0 when the streak is broken. */
  current: number;
  /** Best run ever recorded. Monotonic: it can only ever increase. */
  longest: number;
  /** Yesterday counted but today has no check-in yet. Prompt, do not punish. */
  atRisk: boolean;
  lastCheckIn: LocalDate | null;
};

/**
 * @param checkInDates civil dates, any order, duplicates fine.
 * @param today the teen's civil date, from `localDateOf(now, profile.timezone)`.
 */
export function computeStreak(checkInDates: readonly LocalDate[], today: LocalDate): Streak {
  // A future-dated row means a wrong device clock or a bad import. Counting it
  // would inflate the streak and then break it mysteriously; drop it instead.
  const days = uniqueSortedDates(checkInDates).filter((d) => !isAfter(d, today));

  if (days.length === 0) return { current: 0, longest: 0, atRisk: false, lastCheckIn: null };

  const longest = longestRun(days);
  const last = days[days.length - 1]!;
  const gap = diffDays(last, today);

  // gap 0 => checked in today. gap 1 => yesterday, still alive. 2+ => broken.
  if (gap > 1) return { current: 0, longest, atRisk: false, lastCheckIn: last };

  return {
    current: runEndingAt(days, last),
    longest,
    atRisk: gap === 1,
    lastCheckIn: last,
  };
}

/** Length of the consecutive run that ends on `end`. Assumes sorted+unique. */
function runEndingAt(days: readonly LocalDate[], end: LocalDate): number {
  let run = 0;
  let expected = end;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!;
    const cmp = compareDates(day, expected);
    if (cmp > 0) continue; // after the run we are walking; skip
    if (cmp < 0) break; // a gap: the run ends here
    run++;
    expected = addDays(expected, -1);
  }
  return run;
}

function longestRun(days: readonly LocalDate[]): number {
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = diffDays(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Whether a check-in has already been recorded for the teen's today. Drives the
 * "you have already checked in" state; the spec allows one check-in per day.
 */
export const hasCheckedInToday = (checkInDates: readonly LocalDate[], today: LocalDate): boolean =>
  checkInDates.includes(today);
