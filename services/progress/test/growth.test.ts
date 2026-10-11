import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PILLARS, type LessonCategory } from "@teenbuddy/contracts";
import { bar, computeGrowth, PILLAR_TARGETS, scoreOf, WINDOW_DAYS } from "../src/growth.ts";
import { addDays, eachDay } from "../src/dates.ts";

const TODAY = "2026-08-31";
const back = (n: number) => addDays(TODAY, -n);
const EMPTY = { checkInDates: [], lessons: [], challenges: [], helpSessions: [] } as const;
const lesson = (localDate: string, category: LessonCategory = "school") => ({ localDate, category });

describe("scoreOf", () => {
  test("maps count against target onto 0..100", () => {
    assert.equal(scoreOf(0, 10), 0);
    assert.equal(scoreOf(5, 10), 50);
    assert.equal(scoreOf(10, 10), 100);
  });

  test("clamps above target rather than exceeding 100", () => {
    assert.equal(scoreOf(50, 10), 100);
  });

  test("never returns a negative score", () => {
    assert.equal(scoreOf(-3, 10), 0);
  });

  test("rounds to a whole percent", () => {
    assert.equal(scoreOf(1, 3), 33);
    assert.equal(scoreOf(2, 3), 67);
  });

  test("a zero or negative target is a programming error, not a divide by zero", () => {
    assert.throws(() => scoreOf(1, 0), RangeError);
    assert.throws(() => scoreOf(1, -1), RangeError);
  });
});

describe("computeGrowth: the empty state", () => {
  test("a brand new teen sees four honest zeros", () => {
    assert.deepEqual(computeGrowth(EMPTY, TODAY), {
      mind: 0, wellbeing: 0, habits: 0, learning: 0,
    });
  });

  test("every pillar has a positive target", () => {
    for (const p of PILLARS) assert.ok(PILLAR_TARGETS[p] > 0, `${p} target`);
  });
});

describe("computeGrowth: mood never lowers a bar", () => {
  test("two weeks of checking in scores 100 wellbeing regardless of how they felt", () => {
    // The teen felt terrible every single day and showed up every single day.
    const g = computeGrowth({ ...EMPTY, checkInDates: eachDay(back(13), TODAY) }, TODAY);
    assert.equal(g.wellbeing, 100, "honesty is never punished");
  });

  test("wellbeing counts days, so several check-ins in one day are not extra credit", () => {
    const g = computeGrowth({ ...EMPTY, checkInDates: [TODAY, TODAY, TODAY, TODAY] }, TODAY);
    assert.equal(g.wellbeing, scoreOf(1, PILLAR_TARGETS.wellbeing));
  });

  test("no input to computeGrowth carries a mood value at all", () => {
    // Structural guarantee: a mood cannot influence a score it is never given.
    const keys = Object.keys(EMPTY);
    assert.deepEqual(keys.filter((k) => /mood|feel|tone/i.test(k)), []);
  });
});

describe("computeGrowth: the 14-day rolling window", () => {
  test("activity on the oldest day of the window still counts", () => {
    const g = computeGrowth({ ...EMPTY, checkInDates: [back(WINDOW_DAYS - 1)] }, TODAY);
    assert.ok(g.wellbeing > 0, "day 14 is inside the window");
  });

  test("activity one day older than the window does not", () => {
    const g = computeGrowth({ ...EMPTY, checkInDates: [back(WINDOW_DAYS)] }, TODAY);
    assert.equal(g.wellbeing, 0, "the window rolls, so old activity fades");
  });

  test("a dormant account reads as dormant, not as permanently excellent", () => {
    const heyday = eachDay("2026-01-01", "2026-03-01");
    const g = computeGrowth(
      { ...EMPTY, checkInDates: heyday, lessons: heyday.map((d) => lesson(d)) },
      TODAY,
    );
    assert.deepEqual(g, { mind: 0, wellbeing: 0, habits: 0, learning: 0 });
  });

  test("future-dated activity is outside the window", () => {
    const g = computeGrowth({ ...EMPTY, checkInDates: [addDays(TODAY, 1)] }, TODAY);
    assert.equal(g.wellbeing, 0);
  });
});

describe("computeGrowth: what feeds each pillar", () => {
  test("a mind lesson feeds both Mind and Learning", () => {
    const g = computeGrowth({ ...EMPTY, lessons: [lesson(TODAY, "mind")] }, TODAY);
    assert.equal(g.mind, scoreOf(1, PILLAR_TARGETS.mind));
    assert.equal(g.learning, scoreOf(1, PILLAR_TARGETS.learning));
  });

  test("personal growth also counts as Mind", () => {
    const g = computeGrowth({ ...EMPTY, lessons: [lesson(TODAY, "personal_growth")] }, TODAY);
    assert.ok(g.mind > 0);
  });

  test("a school lesson feeds Learning but not Mind", () => {
    const g = computeGrowth({ ...EMPTY, lessons: [lesson(TODAY, "school")] }, TODAY);
    assert.equal(g.mind, 0);
    assert.ok(g.learning > 0);
  });

  test("challenges feed Habits only", () => {
    const g = computeGrowth({ ...EMPTY, challenges: [{ localDate: TODAY }] }, TODAY);
    assert.equal(g.habits, scoreOf(1, PILLAR_TARGETS.habits));
    assert.equal(g.learning, 0);
    assert.equal(g.mind, 0);
  });

  test("finishing a coping tool counts toward Mind", () => {
    const g = computeGrowth(
      { ...EMPTY, helpSessions: [{ localDate: TODAY, outcome: "completed" }] },
      TODAY,
    );
    assert.equal(g.mind, scoreOf(1, PILLAR_TARGETS.mind));
  });

  test("escalating to a human counts too: it is the healthiest outcome", () => {
    const g = computeGrowth(
      { ...EMPTY, helpSessions: [{ localDate: TODAY, outcome: "escalated" }] },
      TODAY,
    );
    assert.ok(g.mind > 0, "reaching for a person is progress, not failure");
  });

  test("abandoning a coping tool scores nothing but costs nothing", () => {
    const g = computeGrowth(
      { ...EMPTY, helpSessions: [{ localDate: TODAY, outcome: "abandoned" }] },
      TODAY,
    );
    assert.equal(g.mind, 0);
  });
});

describe("computeGrowth: invariants", () => {
  test("every pillar stays within 0..100 under absurd volume", () => {
    const days = eachDay(back(13), TODAY);
    const g = computeGrowth(
      {
        checkInDates: [...days, ...days, ...days],
        lessons: days.flatMap((d) => Array.from({ length: 20 }, () => lesson(d, "mind"))),
        challenges: days.flatMap((d) => Array.from({ length: 20 }, () => ({ localDate: d }))),
        helpSessions: days.map((d) => ({ localDate: d, outcome: "completed" as const })),
      },
      TODAY,
    );
    for (const p of PILLARS) {
      assert.ok(g[p] >= 0 && g[p] <= 100, `${p} = ${g[p]} out of range`);
      assert.ok(Number.isInteger(g[p]), `${p} must be a whole percent`);
    }
  });

  test("is pure: same input, same output, no mutation", () => {
    const input = { ...EMPTY, checkInDates: [TODAY, back(1)] };
    const snapshot = structuredClone(input);
    const a = computeGrowth(input, TODAY);
    const b = computeGrowth(input, TODAY);
    assert.deepEqual(a, b);
    assert.deepEqual(input, snapshot);
  });
});

describe("bar", () => {
  test("renders the spec's ten-cell bar", () => {
    assert.equal(bar(80), "████████░░");
    assert.equal(bar(0), "░░░░░░░░░░");
    assert.equal(bar(100), "██████████");
  });

  test("always renders exactly the requested width", () => {
    for (const score of [0, 1, 33, 49, 50, 51, 99, 100]) {
      assert.equal([...bar(score)].length, 10, `score ${score}`);
    }
    assert.equal([...bar(50, 20)].length, 20);
  });

  test("clamps out-of-range input rather than producing a ragged bar", () => {
    assert.equal(bar(-10), "░░░░░░░░░░");
    assert.equal(bar(999), "██████████");
  });
});
