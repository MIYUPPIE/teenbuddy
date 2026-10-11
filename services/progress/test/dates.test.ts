import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, compareDates, diffDays, eachDay, isAfter, isBefore, isLocalDate,
  isWithinWindow, localDateOf, parseLocalDate, uniqueSortedDates, windowStart,
} from "../src/dates.ts";

describe("localDateOf: the teen's day, not the server's", () => {
  test("Lagos is already tomorrow while UTC is still today", () => {
    const instant = "2026-08-31T23:30:00Z";
    assert.equal(localDateOf(instant, "UTC"), "2026-08-31");
    assert.equal(localDateOf(instant, "Africa/Lagos"), "2026-09-01");
  });

  test("handles the widest real offsets, +14 and -11", () => {
    const noonUtc = "2026-08-31T12:00:00Z";
    assert.equal(localDateOf(noonUtc, "Pacific/Kiritimati"), "2026-09-01", "UTC+14");
    assert.equal(localDateOf("2026-08-31T05:00:00Z", "Pacific/Niue"), "2026-08-30", "UTC-11");
  });

  test("handles half-hour and 45-minute offsets", () => {
    assert.equal(localDateOf("2026-08-30T18:45:00Z", "Asia/Kolkata"), "2026-08-31", "+05:30");
    assert.equal(localDateOf("2026-08-30T18:20:00Z", "Asia/Kathmandu"), "2026-08-31", "+05:45");
    assert.equal(localDateOf("2026-08-30T13:20:00Z", "Pacific/Chatham"), "2026-08-31", "+12:45");
  });

  test("is correct on both sides of a DST transition", () => {
    // US spring forward 2026-03-08 02:00 -> 03:00 local.
    assert.equal(localDateOf("2026-03-08T06:59:00Z", "America/New_York"), "2026-03-08");
    assert.equal(localDateOf("2026-03-08T07:01:00Z", "America/New_York"), "2026-03-08");
    // US fall back 2026-11-01: 01:30 local happens twice; both are Nov 1.
    assert.equal(localDateOf("2026-11-01T05:30:00Z", "America/New_York"), "2026-11-01");
    assert.equal(localDateOf("2026-11-01T06:30:00Z", "America/New_York"), "2026-11-01");
  });

  test("midnight belongs to the day that is starting", () => {
    assert.equal(localDateOf("2026-08-31T00:00:00Z", "UTC"), "2026-08-31");
    assert.equal(localDateOf("2026-08-31T23:59:59.999Z", "UTC"), "2026-08-31");
  });

  test("accepts Date, ISO string and epoch millis alike", () => {
    const ms = Date.parse("2026-08-31T12:00:00Z");
    assert.equal(localDateOf(new Date(ms), "UTC"), "2026-08-31");
    assert.equal(localDateOf("2026-08-31T12:00:00Z", "UTC"), "2026-08-31");
    assert.equal(localDateOf(ms, "UTC"), "2026-08-31");
  });

  test("pads single-digit months and days", () => {
    assert.equal(localDateOf("2026-01-05T12:00:00Z", "UTC"), "2026-01-05");
  });

  test("throws loudly on an invalid instant or unknown zone", () => {
    assert.throws(() => localDateOf("not a date", "UTC"), RangeError);
    assert.throws(() => localDateOf("2026-08-31T12:00:00Z", "Mars/Olympus"), RangeError);
  });

  test("is not affected by the process timezone", () => {
    const before = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Auckland";
      assert.equal(localDateOf("2026-08-31T12:00:00Z", "UTC"), "2026-08-31");
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });
});

describe("parseLocalDate / isLocalDate", () => {
  test("parses valid dates", () => {
    assert.deepEqual(parseLocalDate("2026-08-31"), { year: 2026, month: 8, day: 31 });
  });

  test("rejects impossible calendar days", () => {
    assert.throws(() => parseLocalDate("2026-02-30"), RangeError);
    assert.throws(() => parseLocalDate("2026-04-31"), RangeError);
    assert.throws(() => parseLocalDate("2026-13-01"), RangeError);
    assert.throws(() => parseLocalDate("2026-00-01"), RangeError);
    assert.throws(() => parseLocalDate("31-08-2026"), RangeError);
  });

  test("isLocalDate never throws", () => {
    assert.equal(isLocalDate("2026-08-31"), true);
    assert.equal(isLocalDate("2026-02-30"), false);
    assert.equal(isLocalDate(20260831), false);
    assert.equal(isLocalDate(null), false);
    assert.equal(isLocalDate(undefined), false);
  });
});

describe("addDays: calendar arithmetic, DST-immune", () => {
  test("crosses month and year boundaries", () => {
    assert.equal(addDays("2026-08-31", 1), "2026-09-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  });

  test("handles leap days in both directions", () => {
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
    assert.equal(addDays("2024-02-29", 1), "2024-03-01");
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  });

  test("a DST transition does not eat or duplicate a day", () => {
    // If this used real instants, spring-forward would return 2026-03-08 twice.
    assert.equal(addDays("2026-03-07", 1), "2026-03-08");
    assert.equal(addDays("2026-03-08", 1), "2026-03-09");
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  });

  test("zero is identity and shifts round-trip", () => {
    assert.equal(addDays("2026-08-31", 0), "2026-08-31");
    assert.equal(addDays(addDays("2026-08-31", 37), -37), "2026-08-31");
  });

  test("rejects a fractional shift instead of silently truncating", () => {
    assert.throws(() => addDays("2026-08-31", 1.5), RangeError);
  });

  test("stays correct over a long span", () => {
    assert.equal(addDays("2026-01-01", 365), "2027-01-01");
    assert.equal(addDays("2024-01-01", 366), "2025-01-01", "2024 is a leap year");
  });
});

describe("diffDays / comparisons", () => {
  test("counts whole days in both directions", () => {
    assert.equal(diffDays("2026-08-31", "2026-09-01"), 1);
    assert.equal(diffDays("2026-09-01", "2026-08-31"), -1);
    assert.equal(diffDays("2026-08-31", "2026-08-31"), 0);
  });

  test("is exact across DST, leap days and years", () => {
    assert.equal(diffDays("2026-03-07", "2026-03-09"), 2, "spring forward");
    assert.equal(diffDays("2026-10-31", "2026-11-02"), 2, "fall back");
    assert.equal(diffDays("2024-02-28", "2024-03-01"), 2, "leap year");
    assert.equal(diffDays("2026-01-01", "2027-01-01"), 365);
  });

  test("agrees with addDays for any offset", () => {
    for (const n of [-400, -31, -1, 0, 1, 27, 365]) {
      assert.equal(diffDays("2026-03-07", addDays("2026-03-07", n)), n, `offset ${n}`);
    }
  });

  test("ordering helpers", () => {
    assert.equal(isBefore("2026-08-30", "2026-08-31"), true);
    assert.equal(isBefore("2026-08-31", "2026-08-31"), false);
    assert.equal(isAfter("2026-09-01", "2026-08-31"), true);
    assert.ok(compareDates("2026-08-30", "2026-08-31") < 0);
    assert.equal(compareDates("2026-08-31", "2026-08-31"), 0);
  });
});

describe("windows", () => {
  test("a 14-day window ending today reaches back 13 days", () => {
    assert.equal(windowStart("2026-08-31", 14), "2026-08-18");
    assert.equal(diffDays(windowStart("2026-08-31", 14), "2026-08-31"), 13);
  });

  test("a 1-day window is just today", () => {
    assert.equal(windowStart("2026-08-31", 1), "2026-08-31");
  });

  test("membership is inclusive at both ends", () => {
    assert.equal(isWithinWindow("2026-08-18", "2026-08-31", 14), true, "first day");
    assert.equal(isWithinWindow("2026-08-31", "2026-08-31", 14), true, "last day");
    assert.equal(isWithinWindow("2026-08-17", "2026-08-31", 14), false, "one day too early");
    assert.equal(isWithinWindow("2026-09-01", "2026-08-31", 14), false, "the future");
  });

  test("rejects a nonsensical window length", () => {
    assert.throws(() => windowStart("2026-08-31", 0), RangeError);
    assert.throws(() => windowStart("2026-08-31", -5), RangeError);
  });
});

describe("eachDay / uniqueSortedDates", () => {
  test("is inclusive and ordered", () => {
    assert.deepEqual(eachDay("2026-08-30", "2026-09-01"), ["2026-08-30", "2026-08-31", "2026-09-01"]);
    assert.deepEqual(eachDay("2026-08-31", "2026-08-31"), ["2026-08-31"]);
  });

  test("a backwards range is empty rather than an error", () => {
    assert.deepEqual(eachDay("2026-09-01", "2026-08-31"), []);
  });

  test("dedupes and sorts chronologically, not lexically by accident", () => {
    assert.deepEqual(
      uniqueSortedDates(["2026-09-01", "2026-08-31", "2026-09-01", "2026-08-09"]),
      ["2026-08-09", "2026-08-31", "2026-09-01"],
    );
  });

  test("does not mutate its input", () => {
    const input = ["2026-09-01", "2026-08-31"];
    uniqueSortedDates(input);
    assert.deepEqual(input, ["2026-09-01", "2026-08-31"]);
  });
});
