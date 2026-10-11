import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, ProgressSnapshotSchema } from "@teenbuddy/contracts";
import { achievementHint, earnedAchievements, type AchievementFacts } from "../src/achievements.ts";
import { computeProgress, type ProgressInput } from "../src/index.ts";
import { addDays, eachDay } from "../src/dates.ts";

const NONE: AchievementFacts = {
  checkInsTotal: 0, longestStreakDays: 0, lessonsTotal: 0,
  challengesTotal: 0, difficultMomentsHandled: 0, prosocialActs: 0,
};

describe("achievements", () => {
  test("a new teen has earned none", () => {
    assert.deepEqual(earnedAchievements(NONE), []);
  });

  test("each achievement unlocks at exactly its threshold", () => {
    const cases: [Partial<AchievementFacts>, string][] = [
      [{ checkInsTotal: 1 }, "first_checkin"],
      [{ longestStreakDays: 7 }, "seven_days_consistent"],
      [{ lessonsTotal: 10 }, "ten_lessons"],
      [{ difficultMomentsHandled: 1 }, "overcame_difficult_moment"],
      [{ prosocialActs: 1 }, "helped_someone"],
      [{ challengesTotal: 5 }, "five_challenges"],
    ];
    for (const [facts, id] of cases) {
      assert.deepEqual(earnedAchievements({ ...NONE, ...facts }), [id], `at threshold: ${id}`);
    }
  });

  test("one short of the threshold earns nothing", () => {
    assert.deepEqual(earnedAchievements({ ...NONE, longestStreakDays: 6 }), []);
    assert.deepEqual(earnedAchievements({ ...NONE, lessonsTotal: 9 }), []);
    assert.deepEqual(earnedAchievements({ ...NONE, challengesTotal: 4 }), []);
  });

  test("results keep the declared order so the grid never reshuffles", () => {
    const all = earnedAchievements({
      checkInsTotal: 99, longestStreakDays: 99, lessonsTotal: 99,
      challengesTotal: 99, difficultMomentsHandled: 9, prosocialActs: 9,
    });
    assert.deepEqual(all, [...ACHIEVEMENTS]);
  });

  test("every achievement has an actionable hint", () => {
    for (const id of ACHIEVEMENTS) assert.ok(achievementHint(id).length > 5, id);
  });
});

describe("computeProgress", () => {
  const base: ProgressInput = {
    userId: "u1",
    timeZone: "Africa/Lagos",
    now: "2026-08-31T12:00:00Z",
    checkInDates: [],
    lessons: [],
    challenges: [],
    helpSessions: [],
  };

  test("a brand new account produces a valid, entirely empty snapshot", () => {
    const { snapshot, streak, checkedInToday } = computeProgress(base);
    assert.equal(ProgressSnapshotSchema.parse(snapshot).ok, true);
    assert.deepEqual(snapshot.growth, { mind: 0, wellbeing: 0, habits: 0, learning: 0 });
    assert.equal(snapshot.streakDays, 0);
    assert.equal(snapshot.achievements.length, 0);
    assert.equal(streak.lastCheckIn, null);
    assert.equal(checkedInToday, false);
  });

  test("'today' comes from the teen's zone, not the server's", () => {
    const lateUtc = { ...base, now: "2026-08-31T23:30:00Z" };
    assert.equal(computeProgress({ ...lateUtc, timeZone: "UTC" }).today, "2026-08-31");
    assert.equal(computeProgress({ ...lateUtc, timeZone: "Africa/Lagos" }).today, "2026-09-01");
  });

  test("a teen who checked in at 00:30 Lagos time is counted for today", () => {
    // 2026-08-31T23:30Z is already 2026-09-01 00:30 in Lagos.
    const r = computeProgress({
      ...base,
      now: "2026-08-31T23:30:00Z",
      checkInDates: ["2026-09-01"],
    });
    assert.equal(r.today, "2026-09-01");
    assert.equal(r.checkedInToday, true);
    assert.equal(r.snapshot.streakDays, 1);
  });

  test("a full fortnight produces a coherent snapshot", () => {
    const days = eachDay(addDays("2026-08-31", -13), "2026-08-31");
    const r = computeProgress({
      ...base,
      checkInDates: days,
      lessons: days.slice(0, 10).map((d) => ({ localDate: d, category: "mind" as const })),
      challenges: days.slice(0, 6).map((d) => ({ localDate: d, prosocial: false })),
      helpSessions: [{ localDate: days[2]!, outcome: "completed" }],
    });
    assert.equal(r.snapshot.streakDays, 14);
    assert.equal(r.snapshot.longestStreakDays, 14);
    assert.equal(r.snapshot.growth.wellbeing, 100);
    assert.equal(r.snapshot.growth.learning, 100);
    assert.deepEqual(r.snapshot.achievements, [
      "first_checkin", "seven_days_consistent", "ten_lessons",
      "overcame_difficult_moment", "five_challenges",
    ]);
    assert.equal(
      r.snapshot.achievements.includes("helped_someone"),
      false,
      "no prosocial challenge was completed",
    );
  });

  test("a prosocial challenge earns Helped Someone", () => {
    const r = computeProgress({
      ...base,
      challenges: [{ localDate: "2026-08-31", prosocial: true }],
    });
    assert.ok(r.snapshot.achievements.includes("helped_someone"));
  });

  test("totals count lifetime activity, not just the growth window", () => {
    const r = computeProgress({
      ...base,
      checkInDates: ["2020-01-01", "2020-01-02"],
      lessons: [{ localDate: "2020-01-01", category: "mind" }],
    });
    assert.equal(r.snapshot.checkInsTotal, 2, "totals are lifetime");
    assert.equal(r.snapshot.growth.wellbeing, 0, "but the bars are recent");
    assert.ok(r.snapshot.achievements.includes("first_checkin"), "and achievements are forever");
  });

  test("streakAtRisk is set the day after the last check-in", () => {
    const r = computeProgress({ ...base, checkInDates: ["2026-08-30"] });
    assert.equal(r.today, "2026-08-31");
    assert.equal(r.snapshot.streakAtRisk, true);
    assert.equal(r.snapshot.streakDays, 1, "still alive");
    assert.equal(r.checkedInToday, false);
  });

  test("the result always satisfies the shared contract", () => {
    const days = eachDay("2026-01-01", "2026-08-31");
    const r = computeProgress({
      ...base,
      checkInDates: [...days, ...days],
      lessons: days.map((d) => ({ localDate: d, category: "digital_life" as const })),
      challenges: days.map((d) => ({ localDate: d, prosocial: true })),
      helpSessions: days.map((d) => ({ localDate: d, outcome: "escalated" as const })),
    });
    const parsed = ProgressSnapshotSchema.parse(r.snapshot);
    assert.equal(parsed.ok, true, parsed.ok ? "" : JSON.stringify(parsed.errors));
  });

  test("is deterministic: the same input twice is byte-identical", () => {
    const input = { ...base, checkInDates: ["2026-08-30", "2026-08-31"] };
    assert.equal(
      JSON.stringify(computeProgress(input).snapshot),
      JSON.stringify(computeProgress(input).snapshot),
    );
  });

  test("does not read the wall clock", () => {
    // Same `now` argument, different real time => identical result.
    const input = { ...base, checkInDates: ["2026-08-31"] };
    const first = computeProgress(input);
    const later = computeProgress(input);
    assert.deepEqual(first.snapshot, later.snapshot);
    assert.equal(first.today, "2026-08-31");
  });

  test("rejects an unusable timezone instead of guessing", () => {
    assert.throws(() => computeProgress({ ...base, timeZone: "Mars/Olympus" }), RangeError);
  });
});
