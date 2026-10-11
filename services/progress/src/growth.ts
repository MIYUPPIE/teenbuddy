/**
 * The four growth bars on the Home screen.
 *
 * One product rule dominates the maths here, and it is worth stating loudly:
 *
 *   **A teen's mood never lowers a bar.**
 *
 * A score that drops because someone felt sad would punish honesty in an app
 * whose entire value depends on honest check-ins. So `wellbeing` measures the
 * *practice* of checking in, not the content of it. Every pillar counts actions
 * the teen chose to take; none of them grades how they felt.
 *
 * Scores are a rolling 14-day window, so a bad fortnight fades instead of
 * following someone forever, and a long-dormant account reads as dormant rather
 * than as permanently excellent.
 */

import type { Growth, LessonCategory, Pillar } from "@teenbuddy/contracts";
import { isWithinWindow, type LocalDate } from "./dates.ts";

export const WINDOW_DAYS = 14;

/**
 * Actions in a 14-day window that read as 100%. Deliberately reachable: the
 * point is a full bar for a teen with a decent fortnight, not a grind.
 */
export const PILLAR_TARGETS: Record<Pillar, number> = {
  mind: 6, // a mind/growth lesson or a coping tool used, every other day
  wellbeing: 14, // one check-in a day
  habits: 10, // ten of fourteen daily challenges
  learning: 7, // a lesson every other day
};

/** Lessons that build self-understanding rather than a skill. Feed the Mind bar. */
const MIND_CATEGORIES: ReadonlySet<LessonCategory> = new Set(["mind", "personal_growth"]);

export type GrowthActivity = {
  checkInDates: readonly LocalDate[];
  lessons: readonly { localDate: LocalDate; category: LessonCategory }[];
  challenges: readonly { localDate: LocalDate }[];
  /** A "Help Now" session the teen actually saw through. */
  helpSessions: readonly { localDate: LocalDate; outcome: "completed" | "abandoned" | "escalated" }[];
};

/** 0..100, rounded. Never negative, never above 100. */
export function scoreOf(count: number, target: number): number {
  if (target <= 0) throw new RangeError(`pillar target must be positive, got ${target}`);
  return Math.max(0, Math.min(100, Math.round((count / target) * 100)));
}

export function computeGrowth(activity: GrowthActivity, today: LocalDate): Growth {
  const inWindow = (d: LocalDate): boolean => isWithinWindow(d, today, WINDOW_DAYS);

  // A single check-in per day counts once, however many rows exist.
  const checkInDays = new Set(activity.checkInDates.filter(inWindow)).size;

  const lessonsInWindow = activity.lessons.filter((l) => inWindow(l.localDate));
  const mindLessons = lessonsInWindow.filter((l) => MIND_CATEGORIES.has(l.category)).length;

  // Reaching for a coping tool and finishing it is mind work, and escalating to
  // a human is the healthiest outcome of all - both count, abandoning does not.
  const copingUsed = activity.helpSessions.filter(
    (h) => inWindow(h.localDate) && h.outcome !== "abandoned",
  ).length;

  const challengesDone = activity.challenges.filter((c) => inWindow(c.localDate)).length;

  return {
    mind: scoreOf(mindLessons + copingUsed, PILLAR_TARGETS.mind),
    wellbeing: scoreOf(checkInDays, PILLAR_TARGETS.wellbeing),
    habits: scoreOf(challengesDone, PILLAR_TARGETS.habits),
    learning: scoreOf(lessonsInWindow.length, PILLAR_TARGETS.learning),
  };
}

/** A ten-cell bar, for the `████████░░` rendering in the spec. */
export function bar(score: number, cells = 10): string {
  const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * cells);
  return "█".repeat(filled) + "░".repeat(cells - filled);
}
