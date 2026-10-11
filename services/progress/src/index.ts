/**
 * @teenbuddy/progress - the whole progress system as pure functions.
 *
 * No clock, no IO, no randomness. `now` and `timeZone` come in as arguments, so
 * a test can sit on any date in any zone and get a byte-identical answer. This
 * is the piece most likely to be silently wrong in production and impossible to
 * reproduce, which is exactly why none of it lives in a component.
 */

import {
  ProgressSnapshotSchema, expect as expectValid,
  type LessonCategory, type ProgressSnapshot,
} from "@teenbuddy/contracts";
import { localDateOf, type LocalDate } from "./dates.ts";
import { computeStreak, hasCheckedInToday, type Streak } from "./streak.ts";
import { computeGrowth, WINDOW_DAYS } from "./growth.ts";
import { earnedAchievements, type AchievementFacts } from "./achievements.ts";

export * from "./dates.ts";
export * from "./streak.ts";
export * from "./growth.ts";
export * from "./achievements.ts";

/**
 * Everything the progress system needs, already joined against the content
 * catalogue by the caller. Progress owns the arithmetic; `@teenbuddy/content`
 * owns what a lesson or challenge *is*. Neither imports the other.
 */
export type ProgressInput = {
  userId: string;
  /** IANA zone from the teen's profile. Not the server's, not the browser's guess. */
  timeZone: string;
  /** The current instant. Passed in so every result is reproducible. */
  now: Date | string | number;
  checkInDates: readonly LocalDate[];
  lessons: readonly { localDate: LocalDate; category: LessonCategory }[];
  challenges: readonly { localDate: LocalDate; prosocial: boolean }[];
  helpSessions: readonly {
    localDate: LocalDate;
    outcome: "completed" | "abandoned" | "escalated";
  }[];
};

export type ProgressResult = {
  snapshot: ProgressSnapshot;
  streak: Streak;
  today: LocalDate;
  checkedInToday: boolean;
};

/**
 * The single entry point. Recomputes everything from raw history, so there is
 * no cached counter anywhere that can drift out of step with the records.
 */
export function computeProgress(input: ProgressInput): ProgressResult {
  const today = localDateOf(input.now, input.timeZone);
  const uniqueCheckInDays = new Set(input.checkInDates);

  const streak = computeStreak(input.checkInDates, today);
  const growth = computeGrowth(
    {
      checkInDates: input.checkInDates,
      lessons: input.lessons,
      challenges: input.challenges,
      helpSessions: input.helpSessions,
    },
    today,
  );

  const facts: AchievementFacts = {
    checkInsTotal: uniqueCheckInDays.size,
    longestStreakDays: streak.longest,
    lessonsTotal: input.lessons.length,
    challengesTotal: input.challenges.length,
    difficultMomentsHandled: input.helpSessions.filter((h) => h.outcome !== "abandoned").length,
    prosocialActs: input.challenges.filter((c) => c.prosocial).length,
  };

  const snapshot: ProgressSnapshot = {
    userId: input.userId,
    asOfLocalDate: today,
    growth,
    streakDays: streak.current,
    longestStreakDays: streak.longest,
    streakAtRisk: streak.atRisk,
    achievements: earnedAchievements(facts),
    checkInsTotal: facts.checkInsTotal,
    lessonsTotal: facts.lessonsTotal,
    challengesTotal: facts.challengesTotal,
  };

  // The contract is the guard rail: a formula change that produces an
  // out-of-range bar fails here, in a test, rather than rendering a 240% bar.
  return {
    snapshot: expectValid(ProgressSnapshotSchema, snapshot),
    streak,
    today,
    checkedInToday: hasCheckedInToday(input.checkInDates, today),
  };
}

export { WINDOW_DAYS };
