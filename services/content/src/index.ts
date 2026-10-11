/**
 * @teenbuddy/content - the library, plus the rules for choosing from it.
 *
 * Selection is deterministic on purpose. "Today's challenge" must be the same
 * challenge every time the teen opens the app, on every device, all day, and it
 * must not change because a component re-rendered. `Math.random()` would give a
 * new one on every paint; a date-derived index cannot.
 *
 * Nothing here reads a clock. The caller passes the civil date, which it got
 * from `@teenbuddy/progress`.
 */

import {
  ChallengeSchema, InterventionSchema, LESSON_CATEGORIES, LessonSchema,
  expect as expectValid,
  type Challenge, type HelpTopic, type Intervention, type Lesson, type LessonCategory,
} from "@teenbuddy/contracts";
import { CHALLENGES, CHALLENGE_BY_ID, ROTATION_DAYS } from "./challenges.ts";
import { INTERVENTIONS, INTERVENTION_BY_TOPIC, ORDINARY_TOPICS, interventionFor } from "./interventions.ts";
import { LESSONS, LESSON_BY_SLUG } from "./lessons.ts";

export * from "./lessons.ts";
export * from "./challenges.ts";
export * from "./interventions.ts";

/**
 * The rotation's day zero. Any fixed date works; this one is arbitrary and
 * must never change, because moving it reshuffles everyone's challenge history.
 */
const ROTATION_ANCHOR = "2026-01-01";

const MS_PER_DAY = 86_400_000;

/** Civil-date ordinal. Duplicated from @teenbuddy/progress rather than imported:
 *  content must not depend on another service, only on contracts. */
function ordinalOf(localDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) throw new RangeError(`expected YYYY-MM-DD, got "${localDate}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12) throw new RangeError(`month out of range in "${localDate}"`);
  if (d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate())
    throw new RangeError(`day out of range in "${localDate}"`);
  return Math.round(Date.UTC(y, mo - 1, d) / MS_PER_DAY);
}

/** Modulo that stays non-negative for dates before the anchor. */
function cycleIndex(localDate: string, length: number): number {
  const delta = ordinalOf(localDate) - ordinalOf(ROTATION_ANCHOR);
  return ((delta % length) + length) % length;
}

// --- lessons ----------------------------------------------------------------

export const lessonBySlug = (slug: string): Lesson | null => LESSON_BY_SLUG.get(slug) ?? null;

export const lessonsByCategory = (category: LessonCategory): Lesson[] =>
  LESSONS.filter((l) => l.category === category);

/** Grouped in the order the categories are declared, so the Learn screen is stable. */
export const lessonsGrouped = (): { category: LessonCategory; lessons: Lesson[] }[] =>
  LESSON_CATEGORIES.map((category) => ({ category, lessons: lessonsByCategory(category) }));

/** Lessons relevant to a Help Now topic, for the "read more about this" link. */
export const lessonsForTopic = (topic: HelpTopic): Lesson[] =>
  LESSONS.filter((l) => l.relatedTopics.includes(topic));

/**
 * Today's 2-minute lesson. Rotates through the whole library before repeating,
 * with a stride so consecutive days are not the same category.
 */
export function dailyLesson(localDate: string): Lesson {
  // A stride coprime with the library size visits every lesson exactly once
  // per cycle while jumping across categories each day.
  const STRIDE = 7;
  const step = cycleIndex(localDate, LESSONS.length);
  return LESSONS[(step * STRIDE) % LESSONS.length]!;
}

// --- challenges -------------------------------------------------------------

export const challengeById = (id: string): Challenge | null => CHALLENGE_BY_ID.get(id) ?? null;

/** Today's single challenge. Same date always yields the same challenge. */
export const dailyChallenge = (localDate: string): Challenge =>
  CHALLENGES[cycleIndex(localDate, ROTATION_DAYS)]!;

/** Whether a completed challenge counts toward "Helped Someone". */
export const isProsocial = (challengeId: string): boolean =>
  CHALLENGE_BY_ID.get(challengeId)?.prosocial ?? false;

// --- help now ---------------------------------------------------------------

export { interventionFor, INTERVENTION_BY_TOPIC, ORDINARY_TOPICS };

/**
 * What the Help Now screen should do for a topic.
 *
 * `route: "safety"` is the emergency path: no intervention exists and the
 * caller must hand off to `@teenbuddy/safety` rather than improvise.
 */
export function helpRouteFor(
  topic: HelpTopic,
): { route: "intervention"; intervention: Intervention } | { route: "safety" } {
  const intervention = interventionFor(topic);
  return intervention ? { route: "intervention", intervention } : { route: "safety" };
}

// --- integrity --------------------------------------------------------------

/**
 * Validates the whole library against the shared contracts.
 *
 * Called by the content gate test and by the web app's build step, so a typo in
 * a lesson is a failed build rather than a broken Learn screen in production.
 */
export function validateLibrary(): { lessons: number; challenges: number; interventions: number } {
  for (const l of LESSONS) expectValid(LessonSchema, l);
  for (const c of CHALLENGES) expectValid(ChallengeSchema, c);
  for (const i of INTERVENTIONS) expectValid(InterventionSchema, i);
  return {
    lessons: LESSONS.length,
    challenges: CHALLENGES.length,
    interventions: INTERVENTIONS.length,
  };
}

/** Words per minute assumed for a lesson: reflective reading with pauses, not skimming. */
export const READING_WPM = 100;

export function estimateMinutes(lesson: Lesson): number {
  const words = [lesson.hook, ...lesson.body, lesson.takeaway].join(" ").trim().split(/\s+/).length;
  return Math.max(1, Math.min(3, Math.ceil(words / READING_WPM)));
}
