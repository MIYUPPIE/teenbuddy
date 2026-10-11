import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHALLENGES, LESSONS, ROTATION_DAYS, challengeById, dailyChallenge, dailyLesson,
  helpRouteFor, interventionFor, isProsocial, lessonBySlug, lessonsGrouped,
} from "../src/index.ts";

/** Civil-date walker, local to the test so it cannot inherit a bug from src. */
const day = (start: string, n: number): string => {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

describe("dailyChallenge is deterministic", () => {
  test("the same date always yields the same challenge", () => {
    const first = dailyChallenge("2026-08-31");
    for (let i = 0; i < 50; i++) {
      assert.equal(dailyChallenge("2026-08-31").id, first.id, "re-render must not reshuffle");
    }
  });

  test("consecutive days give different challenges", () => {
    for (let i = 0; i < ROTATION_DAYS; i++) {
      const a = dailyChallenge(day("2026-08-01", i));
      const b = dailyChallenge(day("2026-08-01", i + 1));
      assert.notEqual(a.id, b.id, `${a.id} repeated on consecutive days`);
    }
  });

  test("one full rotation visits every challenge exactly once", () => {
    const seen = Array.from({ length: ROTATION_DAYS }, (_, i) =>
      dailyChallenge(day("2026-08-01", i)).id,
    );
    assert.equal(new Set(seen).size, ROTATION_DAYS, "no repeats within a cycle");
    assert.deepEqual([...seen].sort(), CHALLENGES.map((c) => c.id).sort());
  });

  test("it repeats after exactly one rotation, not sooner", () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(
        dailyChallenge(day("2026-08-01", i)).id,
        dailyChallenge(day("2026-08-01", i + ROTATION_DAYS)).id,
      );
    }
  });

  test("works for dates before the rotation anchor", () => {
    // A negative modulo would throw or return undefined here.
    for (const d of ["2025-12-31", "2020-06-15", "2000-01-01"]) {
      const c = dailyChallenge(d);
      assert.ok(c && typeof c.id === "string", `no challenge for ${d}`);
    }
  });

  test("is continuous across month, year, leap and DST boundaries", () => {
    for (const d of ["2026-01-31", "2026-12-31", "2024-02-29", "2026-03-08", "2026-11-01"]) {
      assert.ok(dailyChallenge(d).id, d);
      assert.notEqual(dailyChallenge(d).id, dailyChallenge(day(d, 1)).id, `stuck at ${d}`);
    }
  });

  test("rejects a malformed or impossible date instead of returning item zero", () => {
    assert.throws(() => dailyChallenge("31-08-2026"), RangeError);
    assert.throws(() => dailyChallenge("2026-02-30"), RangeError);
    assert.throws(() => dailyChallenge("2026-13-01"), RangeError);
    assert.throws(() => dailyChallenge(""), RangeError);
  });
});

describe("dailyLesson is deterministic", () => {
  test("the same date always yields the same lesson", () => {
    const first = dailyLesson("2026-08-31").slug;
    for (let i = 0; i < 50; i++) assert.equal(dailyLesson("2026-08-31").slug, first);
  });

  test("one cycle visits every lesson exactly once", () => {
    const seen = Array.from({ length: LESSONS.length }, (_, i) =>
      dailyLesson(day("2026-08-01", i)).slug,
    );
    assert.equal(new Set(seen).size, LESSONS.length, "the stride must be coprime with the library");
  });

  test("consecutive days usually change category, so the Learn feed feels varied", () => {
    let sameCategoryRuns = 0;
    for (let i = 0; i < LESSONS.length; i++) {
      if (dailyLesson(day("2026-08-01", i)).category === dailyLesson(day("2026-08-01", i + 1)).category)
        sameCategoryRuns++;
    }
    assert.ok(sameCategoryRuns <= 5, `${sameCategoryRuns} same-category pairs in a cycle`);
  });

  test("today's lesson and today's challenge do not both need the same date maths", () => {
    // Independent cycles: they must not lock into step and repeat as a pair.
    const pairs = new Set(
      Array.from({ length: 60 }, (_, i) => {
        const d = day("2026-01-01", i);
        return `${dailyLesson(d).slug}|${dailyChallenge(d).id}`;
      }),
    );
    assert.equal(pairs.size, 60, "lesson/challenge pairs should not repeat within 60 days");
  });
});

describe("lookups", () => {
  test("by id and slug", () => {
    assert.equal(lessonBySlug("procrastination")?.slug, "procrastination");
    assert.ok((lessonBySlug("procrastination")?.title.length ?? 0) > 0);
    assert.equal(challengeById("phone-away-30")?.pillar, "habits");
  });

  test("a missing id returns null rather than throwing or returning undefined", () => {
    assert.equal(lessonBySlug("does-not-exist"), null);
    assert.equal(challengeById("does-not-exist"), null);
    assert.equal(lessonBySlug(""), null);
  });

  test("isProsocial is false for an unknown challenge, never true by accident", () => {
    assert.equal(isProsocial("appreciate-someone"), true);
    assert.equal(isProsocial("phone-away-30"), false);
    assert.equal(isProsocial("does-not-exist"), false);
  });

  test("lessonsGrouped covers every lesson exactly once, in a stable order", () => {
    const grouped = lessonsGrouped();
    const flat = grouped.flatMap((g) => g.lessons);
    assert.equal(flat.length, LESSONS.length);
    assert.equal(new Set(flat.map((l) => l.slug)).size, LESSONS.length);
    assert.deepEqual(grouped.map((g) => g.category), lessonsGrouped().map((g) => g.category));
  });
});

describe("helpRouteFor", () => {
  test("an ordinary topic gets its intervention", () => {
    const r = helpRouteFor("anxiety_stress");
    assert.equal(r.route, "intervention");
    assert.equal(r.route === "intervention" && r.intervention.topic, "anxiety_stress");
  });

  test("not_safe routes to the safety service and carries no intervention", () => {
    const r = helpRouteFor("not_safe");
    assert.equal(r.route, "safety");
    assert.equal("intervention" in r, false, "no coping exercise may leak into the emergency path");
    assert.equal(interventionFor("not_safe"), null);
  });
});
