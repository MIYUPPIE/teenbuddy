import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CAUSES, HELP_TOPICS, LESSON_CATEGORIES, MOODS, PILLARS } from "@teenbuddy/contracts";
import { CATEGORY_HUE, CAUSE_HUE, MOOD_HUE, PILLAR_HUE, topicHue } from "../src/lib/palette.ts";

const inRange = (h: number) => Number.isFinite(h) && h >= 0 && h < 360;

describe("every enum value has a colour", () => {
  test("moods", () => {
    for (const m of MOODS) assert.ok(inRange(MOOD_HUE[m]), `mood ${m} has no valid hue`);
  });

  test("causes", () => {
    for (const c of CAUSES) assert.ok(inRange(CAUSE_HUE[c]), `cause ${c} has no valid hue`);
  });

  test("pillars", () => {
    for (const p of PILLARS) assert.ok(inRange(PILLAR_HUE[p]), `pillar ${p} has no valid hue`);
  });

  test("lesson categories", () => {
    for (const c of LESSON_CATEGORIES) assert.ok(inRange(CATEGORY_HUE[c]), `category ${c} has no valid hue`);
  });

  test("every help topic except the emergency one", () => {
    for (const t of HELP_TOPICS) {
      if (t === "not_safe") continue;
      assert.ok(inRange(topicHue(t) ?? -1), `topic ${t} has no valid hue`);
    }
  });
});

describe("the emergency topic is never tinted", () => {
  test("not_safe returns null so it cannot pick up a cheerful colour", () => {
    assert.equal(topicHue("not_safe"), null);
  });
});

describe("colour carries information", () => {
  test("moods with opposite feelings are far apart on the wheel", () => {
    const distance = (a: number, b: number) => {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };
    assert.ok(distance(MOOD_HUE.great, MOOD_HUE.sad) > 90, "great and sad must not look alike");
    assert.ok(distance(MOOD_HUE.great, MOOD_HUE.angry) > 40, "great and angry must not look alike");
  });

  test("a pillar and its matching lesson category share a hue", () => {
    // Mind lessons feed the Mind bar, so they read as the same thing.
    assert.equal(CATEGORY_HUE.mind, PILLAR_HUE.mind);
    assert.equal(CATEGORY_HUE.digital_life, PILLAR_HUE.learning);
  });

  test("no two pillars share a hue", () => {
    const hues = PILLARS.map((p) => PILLAR_HUE[p]);
    assert.equal(new Set(hues).size, hues.length, "pillars must be distinguishable at a glance");
  });
});
