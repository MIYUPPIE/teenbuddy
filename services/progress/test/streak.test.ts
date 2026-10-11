import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, hasCheckedInToday } from "../src/streak.ts";
import { addDays, eachDay } from "../src/dates.ts";

const TODAY = "2026-08-31";
const back = (n: number) => addDays(TODAY, -n);

describe("computeStreak: the empty and single cases", () => {
  test("no history is a clean zero, not a broken streak", () => {
    assert.deepEqual(computeStreak([], TODAY), {
      current: 0, longest: 0, atRisk: false, lastCheckIn: null,
    });
  });

  test("checking in today for the first time starts a streak of one", () => {
    const s = computeStreak([TODAY], TODAY);
    assert.equal(s.current, 1);
    assert.equal(s.longest, 1);
    assert.equal(s.atRisk, false);
    assert.equal(s.lastCheckIn, TODAY);
  });
});

describe("computeStreak: alive, at risk, broken", () => {
  test("a run ending today counts every day", () => {
    const s = computeStreak(eachDay(back(6), TODAY), TODAY);
    assert.equal(s.current, 7);
    assert.equal(s.atRisk, false);
  });

  test("a run ending yesterday is alive but at risk", () => {
    const s = computeStreak(eachDay(back(7), back(1)), TODAY);
    assert.equal(s.current, 7, "the streak is NOT reset just because today is empty");
    assert.equal(s.atRisk, true, "the UI can prompt before it is too late");
    assert.equal(s.lastCheckIn, back(1));
  });

  test("a gap of a full day breaks it", () => {
    const s = computeStreak(eachDay(back(8), back(2)), TODAY);
    assert.equal(s.current, 0);
    assert.equal(s.atRisk, false);
    assert.equal(s.longest, 7, "but the record survives");
  });

  test("checking in today after a break restarts at one", () => {
    const s = computeStreak([...eachDay(back(10), back(5)), TODAY], TODAY);
    assert.equal(s.current, 1);
    assert.equal(s.longest, 6);
  });

  test("only the run touching today or yesterday is current", () => {
    const s = computeStreak([...eachDay(back(30), back(11)), ...eachDay(back(2), TODAY)], TODAY);
    assert.equal(s.current, 3, "the recent run, not the 20-day one");
    assert.equal(s.longest, 20, "which is still the record");
  });
});

describe("computeStreak: messy real-world input", () => {
  test("duplicate check-ins on one day count once", () => {
    const s = computeStreak([TODAY, TODAY, TODAY, back(1)], TODAY);
    assert.equal(s.current, 2);
  });

  test("unsorted input gives the same answer as sorted", () => {
    const days = eachDay(back(4), TODAY);
    const shuffled = [days[3]!, days[0]!, days[4]!, days[1]!, days[2]!];
    assert.deepEqual(computeStreak(shuffled, TODAY), computeStreak(days, TODAY));
  });

  test("future-dated rows from a wrong device clock are ignored", () => {
    const s = computeStreak([addDays(TODAY, 5), TODAY, back(1)], TODAY);
    assert.equal(s.current, 2, "tomorrow cannot pad today's streak");
    assert.equal(s.lastCheckIn, TODAY);
  });

  test("a history made only of future dates is empty", () => {
    const s = computeStreak([addDays(TODAY, 1), addDays(TODAY, 2)], TODAY);
    assert.deepEqual(s, { current: 0, longest: 0, atRisk: false, lastCheckIn: null });
  });

  test("does not mutate the caller's array", () => {
    const input = [back(1), TODAY, back(1)];
    const copy = [...input];
    computeStreak(input, TODAY);
    assert.deepEqual(input, copy);
  });
});

describe("computeStreak: calendar edges", () => {
  test("runs across a month boundary", () => {
    const s = computeStreak(["2026-08-30", "2026-08-31", "2026-09-01"], "2026-09-01");
    assert.equal(s.current, 3);
  });

  test("runs across a year boundary", () => {
    const s = computeStreak(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01");
    assert.equal(s.current, 3);
  });

  test("runs across a leap day", () => {
    const s = computeStreak(["2024-02-28", "2024-02-29", "2024-03-01"], "2024-03-01");
    assert.equal(s.current, 3);
  });

  test("a DST transition does not break a streak", () => {
    // The bug this guards: instant-based maths makes 2026-03-08 -> 2026-03-09
    // look like 23 hours and drops a day from the run.
    const s = computeStreak(eachDay("2026-03-06", "2026-03-10"), "2026-03-10");
    assert.equal(s.current, 5);
    const fall = computeStreak(eachDay("2026-10-30", "2026-11-03"), "2026-11-03");
    assert.equal(fall.current, 5);
  });
});

describe("computeStreak: longest is monotonic", () => {
  test("longest never drops as history grows", () => {
    let previous = 0;
    const days: string[] = [];
    for (const d of eachDay(back(20), TODAY)) {
      days.push(d);
      const { longest } = computeStreak(days, TODAY);
      assert.ok(longest >= previous, `longest went backwards at ${d}`);
      previous = longest;
    }
    assert.equal(previous, 21);
  });

  test("longest survives a later break", () => {
    const s = computeStreak(eachDay(back(40), back(20)), TODAY);
    assert.equal(s.current, 0);
    assert.equal(s.longest, 21);
  });

  test("a single isolated day is a run of one", () => {
    assert.equal(computeStreak([back(100)], TODAY).longest, 1);
  });
});

describe("hasCheckedInToday", () => {
  test("is true only for the teen's own today", () => {
    assert.equal(hasCheckedInToday([TODAY], TODAY), true);
    assert.equal(hasCheckedInToday([back(1)], TODAY), false);
    assert.equal(hasCheckedInToday([], TODAY), false);
  });
});
