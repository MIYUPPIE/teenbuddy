/**
 * Achievements are pure predicates over lifetime totals, so they can be
 * recomputed from scratch at any time and never drift from the underlying data.
 *
 * They are awarded for showing up and for reaching out. None of them rewards a
 * mood, and none can be lost.
 */

import { ACHIEVEMENTS, type AchievementId } from "@teenbuddy/contracts";

export type AchievementFacts = {
  checkInsTotal: number;
  longestStreakDays: number;
  lessonsTotal: number;
  challengesTotal: number;
  /** Help Now sessions the teen finished or escalated, rather than bounced from. */
  difficultMomentsHandled: number;
  /** Prosocial challenges completed, e.g. "tell someone you appreciate them". */
  prosocialActs: number;
};

const RULES: Record<AchievementId, { test: (f: AchievementFacts) => boolean; hint: string }> = {
  first_checkin: {
    test: (f) => f.checkInsTotal >= 1,
    hint: "Check in once.",
  },
  seven_days_consistent: {
    test: (f) => f.longestStreakDays >= 7,
    hint: "Check in seven days in a row.",
  },
  ten_lessons: {
    test: (f) => f.lessonsTotal >= 10,
    hint: "Finish ten 2-minute lessons.",
  },
  overcame_difficult_moment: {
    test: (f) => f.difficultMomentsHandled >= 1,
    hint: "Use Help Now and see it through.",
  },
  helped_someone: {
    test: (f) => f.prosocialActs >= 1,
    hint: "Complete a challenge that involves someone else.",
  },
  five_challenges: {
    test: (f) => f.challengesTotal >= 5,
    hint: "Complete five daily challenges.",
  },
};

/** Returned in the declared order so the profile grid never reshuffles. */
export function earnedAchievements(facts: AchievementFacts): AchievementId[] {
  return ACHIEVEMENTS.filter((id) => RULES[id].test(facts));
}

export const achievementHint = (id: AchievementId): string => RULES[id].hint;
