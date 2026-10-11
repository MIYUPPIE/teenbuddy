import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  array, boolean, expect as expectValid, formatIssues, integer, isoInstant,
  literal, localDate, object, oneOf, optional, record, refine, string,
  timezone, union,
} from "../src/validate.ts";

const fails = (r: { ok: boolean }): r is { ok: false; errors: { path: string; message: string }[] } =>
  r.ok === false;

describe("string", () => {
  test("accepts and enforces bounds", () => {
    assert.deepEqual(string().parse("hi"), { ok: true, value: "hi" });
    assert.equal(string({ min: 3 }).parse("hi").ok, false);
    assert.equal(string({ max: 1 }).parse("hi").ok, false);
    assert.equal(string({ min: 1, max: 2 }).parse("hi").ok, true);
  });

  test("rejects non-strings with the actual type named", () => {
    const r = string().parse(42, "field");
    assert.ok(fails(r));
    assert.deepEqual(r.errors, [{ path: "field", message: "expected string, got number" }]);
  });

  test("distinguishes null and array from object", () => {
    const rn = string().parse(null);
    const ra = string().parse([]);
    assert.ok(fails(rn) && rn.errors[0]!.message.endsWith("got null"));
    assert.ok(fails(ra) && ra.errors[0]!.message.endsWith("got array"));
  });

  test("empty string is valid unless min says otherwise", () => {
    assert.equal(string().parse("").ok, true);
    assert.equal(string({ min: 1 }).parse("").ok, false);
  });
});

describe("integer", () => {
  test("rejects floats, NaN and Infinity", () => {
    assert.equal(integer().parse(1.5).ok, false);
    assert.equal(integer().parse(Number.NaN).ok, false);
    assert.equal(integer().parse(Number.POSITIVE_INFINITY).ok, false);
    assert.equal(integer().parse(-3).ok, true);
  });

  test("enforces range inclusively", () => {
    const v = integer({ min: 0, max: 100 });
    assert.equal(v.parse(0).ok, true);
    assert.equal(v.parse(100).ok, true);
    assert.equal(v.parse(-1).ok, false);
    assert.equal(v.parse(101).ok, false);
  });
});

describe("boolean", () => {
  test("does not coerce truthy values", () => {
    assert.equal(boolean().parse(true).ok, true);
    assert.equal(boolean().parse("true").ok, false);
    assert.equal(boolean().parse(1).ok, false);
    assert.equal(boolean().parse(0).ok, false);
  });
});

describe("localDate", () => {
  test("accepts a real calendar day", () => {
    assert.deepEqual(localDate().parse("2026-02-28"), { ok: true, value: "2026-02-28" });
  });

  test("rejects days that do not exist", () => {
    assert.equal(localDate().parse("2026-02-30").ok, false);
    assert.equal(localDate().parse("2026-13-01").ok, false);
    assert.equal(localDate().parse("2026-00-10").ok, false);
    assert.equal(localDate().parse("2026-04-31").ok, false);
  });

  test("handles leap years", () => {
    assert.equal(localDate().parse("2024-02-29").ok, true, "2024 is a leap year");
    assert.equal(localDate().parse("2026-02-29").ok, false, "2026 is not");
    assert.equal(localDate().parse("2000-02-29").ok, true, "2000 is a leap year");
    assert.equal(localDate().parse("1900-02-29").ok, false, "1900 is not");
  });

  test("rejects timestamps and loose formats", () => {
    assert.equal(localDate().parse("2026-2-8").ok, false);
    assert.equal(localDate().parse("2026-02-08T10:00:00Z").ok, false);
    assert.equal(localDate().parse("").ok, false);
  });
});

describe("isoInstant", () => {
  test("accepts parseable instants, rejects nonsense", () => {
    assert.equal(isoInstant().parse("2026-08-31T09:00:00.000Z").ok, true);
    assert.equal(isoInstant().parse("not a date").ok, false);
    assert.equal(isoInstant().parse(1_735_689_600_000).ok, false);
  });
});

describe("timezone", () => {
  test("accepts IANA zones the runtime knows", () => {
    assert.equal(timezone().parse("Africa/Lagos").ok, true);
    assert.equal(timezone().parse("America/New_York").ok, true);
    assert.equal(timezone().parse("UTC").ok, true);
  });

  test("rejects invented zones", () => {
    assert.equal(timezone().parse("Mars/Olympus").ok, false);
    assert.equal(timezone().parse("GMT+1").ok, false);
  });
});

describe("oneOf / literal", () => {
  test("oneOf lists the allowed values in the error", () => {
    const v = oneOf(["a", "b"] as const);
    assert.equal(v.parse("a").ok, true);
    const r = v.parse("c");
    assert.ok(fails(r));
    assert.match(r.errors[0]!.message, /expected one of a, b/);
  });

  test("literal matches exactly", () => {
    assert.equal(literal("x").parse("x").ok, true);
    assert.equal(literal("x").parse("y").ok, false);
  });
});

describe("optional", () => {
  test("treats undefined and null as absent", () => {
    const v = optional(string());
    assert.deepEqual(v.parse(undefined), { ok: true, value: undefined });
    assert.deepEqual(v.parse(null), { ok: true, value: undefined });
  });

  test("still validates a present value", () => {
    assert.equal(optional(integer()).parse("nope").ok, false);
  });
});

describe("array", () => {
  test("reports the index of every bad item", () => {
    const r = array(integer()).parse([1, "x", 3, "y"], "nums");
    assert.ok(fails(r));
    assert.equal(r.errors.length, 2);
    assert.deepEqual(r.errors.map((e) => e.path), ["nums[1]", "nums[3]"]);
  });

  test("enforces length bounds", () => {
    assert.equal(array(integer(), { min: 1 }).parse([]).ok, false);
    assert.equal(array(integer(), { max: 2 }).parse([1, 2, 3]).ok, false);
  });

  test("rejects non-arrays", () => {
    assert.equal(array(integer()).parse({ 0: 1 }).ok, false);
  });
});

describe("object", () => {
  const Person = object({ name: string({ min: 1 }), age: integer({ min: 0 }) }, "Person");

  test("collects every field error at once", () => {
    const r = Person.parse({ name: "", age: -1 });
    assert.ok(fails(r));
    assert.equal(r.errors.length, 2, "one pass reports both problems");
    assert.deepEqual(r.errors.map((e) => e.path), ["name", "age"]);
  });

  test("strips unknown keys instead of failing", () => {
    const r = Person.parse({ name: "Ada", age: 15, injected: "<script>" });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { name: "Ada", age: 15 });
    assert.equal("injected" in r.value, false);
  });

  test("omits absent optionals rather than storing undefined", () => {
    const v = object({ a: string(), b: optional(string()) });
    const r = v.parse({ a: "x" });
    assert.ok(r.ok);
    assert.deepEqual(Object.keys(r.value), ["a"], "no undefined key reaches Firestore");
  });

  test("nests paths through arrays and objects", () => {
    const v = object({ items: array(object({ id: string({ min: 1 }) })) });
    const r = v.parse({ items: [{ id: "ok" }, { id: "" }] });
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.path, "items[1].id");
  });

  test("rejects arrays and null as objects", () => {
    assert.equal(Person.parse([]).ok, false);
    assert.equal(Person.parse(null).ok, false);
  });
});

describe("record", () => {
  test("validates every value and keeps keys", () => {
    const v = record(integer());
    assert.deepEqual(v.parse({ a: 1, b: 2 }), { ok: true, value: { a: 1, b: 2 } });
    const r = v.parse({ a: 1, b: "x" }, "scores");
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.path, "scores.b");
  });
});

describe("union", () => {
  const v = union("kind", {
    dog: object({ kind: literal("dog"), bark: boolean() }),
    cat: object({ kind: literal("cat"), lives: integer() }),
  });

  test("dispatches on the discriminant", () => {
    assert.equal(v.parse({ kind: "dog", bark: true }).ok, true);
    assert.equal(v.parse({ kind: "cat", lives: 9 }).ok, true);
  });

  test("errors point at the discriminant when the tag is unknown", () => {
    const r = v.parse({ kind: "fish" }, "pet");
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.path, "pet.kind");
  });

  test("errors point inside the chosen variant when the tag is known", () => {
    const r = v.parse({ kind: "cat", lives: "nine" }, "pet");
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.path, "pet.lives");
  });
});

describe("refine", () => {
  const v = refine(object({ min: integer(), max: integer() }), (o) =>
    o.min <= o.max ? null : "min must not exceed max",
  );

  test("runs only after the inner shape passes", () => {
    assert.equal(v.parse({ min: 1, max: 2 }).ok, true);
    const r = v.parse({ min: 5, max: 1 });
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.message, "min must not exceed max");
  });

  test("does not mask a shape error with a cross-field error", () => {
    const r = v.parse({ min: "a", max: 1 });
    assert.ok(fails(r));
    assert.equal(r.errors[0]!.path, "min");
  });
});

describe("expect / formatIssues", () => {
  test("expect returns the parsed value", () => {
    assert.equal(expectValid(string(), "ok"), "ok");
  });

  test("expect throws a TypeError naming the schema and field", () => {
    const Person = object({ name: string({ min: 1 }) }, "Person");
    assert.throws(() => expectValid(Person, { name: "" }), (e: unknown) => {
      assert.ok(e instanceof TypeError);
      assert.match(e.message, /Person validation failed/);
      assert.match(e.message, /name:/);
      return true;
    });
  });

  test("formatIssues renders <root> for a top-level failure", () => {
    const r = string().parse(1);
    assert.ok(fails(r));
    assert.equal(formatIssues(r.errors), "<root>: expected string, got number");
  });
});

describe("purity", () => {
  test("parsing never mutates its input", () => {
    const input = { name: "Ada", age: 15, extra: true };
    const frozen = structuredClone(input);
    object({ name: string(), age: integer() }).parse(input);
    assert.deepEqual(input, frozen);
  });

  test("the same input always yields the same result", () => {
    const v = object({ d: localDate() });
    const a = JSON.stringify(v.parse({ d: "2026-02-30" }));
    const b = JSON.stringify(v.parse({ d: "2026-02-30" }));
    assert.equal(a, b);
  });
});
