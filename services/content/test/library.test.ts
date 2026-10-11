import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ChallengeSchema, HELP_TOPICS, InterventionSchema, LESSON_CATEGORIES,
  LessonSchema, PILLARS,
} from "@teenbuddy/contracts";
import {
  CHALLENGES, INTERVENTIONS, LESSONS, ORDINARY_TOPICS, READING_WPM,
  estimateMinutes, lessonsForTopic, validateLibrary,
} from "../src/index.ts";

describe("the library validates against the shared contracts", () => {
  test("every lesson, challenge and intervention passes its schema", () => {
    const counts = validateLibrary();
    assert.deepEqual(counts, { lessons: 25, challenges: 28, interventions: 8 });
  });

  test("each item validates individually, so a failure names itself", () => {
    for (const l of LESSONS) {
      const r = LessonSchema.parse(l);
      assert.equal(r.ok, true, `lesson ${l.slug}: ${r.ok ? "" : JSON.stringify(r.errors)}`);
    }
    for (const c of CHALLENGES) {
      const r = ChallengeSchema.parse(c);
      assert.equal(r.ok, true, `challenge ${c.id}: ${r.ok ? "" : JSON.stringify(r.errors)}`);
    }
    for (const i of INTERVENTIONS) {
      const r = InterventionSchema.parse(i);
      assert.equal(r.ok, true, `intervention ${i.id}: ${r.ok ? "" : JSON.stringify(r.errors)}`);
    }
  });
});

describe("lessons", () => {
  test("ids are unique", () => {
    assert.equal(new Set(LESSONS.map((l) => l.slug)).size, LESSONS.length);
  });

  test("every category from the spec has lessons", () => {
    for (const c of LESSON_CATEGORIES) {
      const n = LESSONS.filter((l) => l.category === c).length;
      assert.ok(n >= 4, `category ${c} has only ${n} lessons`);
    }
  });

  test("the stated minutes matches the word count, not a guess", () => {
    for (const l of LESSONS) {
      assert.equal(
        l.minutes,
        estimateMinutes(l),
        `${l.slug} claims ${l.minutes} min but reads as ${estimateMinutes(l)} at ${READING_WPM} wpm`,
      );
    }
  });

  test("no lesson exceeds the 3-minute promise", () => {
    for (const l of LESSONS) assert.ok(l.minutes <= 3, `${l.slug} is ${l.minutes} minutes`);
  });

  test("every lesson ends with an actionable takeaway", () => {
    for (const l of LESSONS) {
      assert.ok(l.takeaway.length >= 20, `${l.slug} takeaway is too thin`);
      assert.ok(l.hook.length >= 20, `${l.slug} hook is too thin`);
    }
  });

  test("no lesson diagnoses the reader", () => {
    // A lesson is not allowed to tell a teen what condition they have.
    const banned = /\byou (?:have|are suffering from|might have)\s+(?:depression|anxiety disorder|adhd|ocd|ptsd|bipolar)\b/i;
    for (const l of LESSONS) {
      const text = [l.hook, ...l.body, l.takeaway].join(" ");
      assert.doesNotMatch(text, banned, `${l.slug} reads as a diagnosis`);
    }
  });

  test("every related topic is a real help topic", () => {
    for (const l of LESSONS)
      for (const t of l.relatedTopics)
        assert.ok(HELP_TOPICS.includes(t), `${l.slug} references unknown topic ${t}`);
  });

  test("every ordinary help topic has at least one lesson behind it", () => {
    for (const t of ORDINARY_TOPICS)
      assert.ok(lessonsForTopic(t).length >= 1, `no lesson supports topic ${t}`);
  });

  test("the spec's hardest subjects are covered rather than avoided", () => {
    const slugs = LESSONS.map((l) => l.slug);
    for (const required of ["pornography", "cyberbullying", "healthy-relationships", "exam-stress"])
      assert.ok(slugs.includes(required), `missing lesson: ${required}`);
  });
});

describe("challenges", () => {
  test("ids are unique", () => {
    assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, CHALLENGES.length);
  });

  test("the rotation is four full weeks", () => {
    assert.equal(CHALLENGES.length, 28);
  });

  test("every pillar appears and none dominates", () => {
    for (const p of PILLARS) {
      const n = CHALLENGES.filter((c) => c.pillar === p).length;
      assert.ok(n >= 4, `pillar ${p} has only ${n} challenges`);
      assert.ok(n <= CHALLENGES.length / 2, `pillar ${p} dominates with ${n}`);
    }
  });

  test("at least a quarter involve another person", () => {
    const prosocial = CHALLENGES.filter((c) => c.prosocial).length;
    assert.ok(
      prosocial >= CHALLENGES.length / 4,
      `only ${prosocial} prosocial challenges: "Helped Someone" would be hard to reach`,
    );
  });

  test("every challenge is finishable in an hour", () => {
    for (const c of CHALLENGES) assert.ok(c.minutes <= 60, `${c.id} takes ${c.minutes} minutes`);
  });

  test("every challenge explains why it is worth doing", () => {
    for (const c of CHALLENGES) assert.ok(c.why.length >= 20, `${c.id} has no real reason`);
  });

  test("prompts are single imperative actions, not lists", () => {
    for (const c of CHALLENGES) {
      assert.doesNotMatch(c.prompt, / and then /i, `${c.id} chains two tasks`);
      assert.ok(c.prompt.length <= 160, `${c.id} prompt is too long`);
    }
  });
});

describe("interventions", () => {
  test("exactly one per ordinary topic", () => {
    assert.equal(INTERVENTIONS.length, ORDINARY_TOPICS.length);
    for (const t of ORDINARY_TOPICS)
      assert.equal(
        INTERVENTIONS.filter((i) => i.topic === t).length,
        1,
        `topic ${t} needs exactly one intervention`,
      );
  });

  test("none exists for not_safe: that topic must reach a human", () => {
    assert.equal(INTERVENTIONS.some((i) => i.topic === "not_safe"), false);
  });

  test("the schema itself refuses an intervention for not_safe", () => {
    const smuggled = { ...INTERVENTIONS[0]!, id: "sneaky", topic: "not_safe" };
    const r = InterventionSchema.parse(smuggled);
    assert.equal(r.ok, false, "a not_safe intervention must be unrepresentable");
    assert.ok(!r.ok && /route to the safety service/.test(r.errors[0]!.message));
  });

  test("every intervention offers a route to a person", () => {
    for (const i of INTERVENTIONS) {
      const human = i.nextSteps.some((s) => /talk|someone|message|keep talking/i.test(s));
      assert.ok(human, `${i.id} offers no way to reach a human`);
    }
  });

  test("script lines are short enough to read while distressed", () => {
    for (const i of INTERVENTIONS)
      for (const line of i.script)
        assert.ok(line.length <= 160, `${i.id} has a ${line.length}-char line: "${line}"`);
  });

  test("each takes between 30 seconds and 3 minutes", () => {
    for (const i of INTERVENTIONS) {
      assert.ok(i.durationSeconds >= 30, `${i.id} is too short to work`);
      assert.ok(i.durationSeconds <= 180, `${i.id} is too long for a crisis moment`);
    }
  });

  test("the anxiety intervention is the 4-4-6 breathing from the spec", () => {
    const anxiety = INTERVENTIONS.find((i) => i.topic === "anxiety_stress")!;
    const script = anxiety.script.join(" ");
    assert.match(script, /4 seconds/, "in for 4");
    assert.match(script, /6 seconds/, "out for 6");
    assert.match(anxiety.closing, /one moment, not your entire future/);
  });

  test("no intervention shames the teen for the feeling", () => {
    const shaming = /\b(?:you shouldn't feel|stop being|don't be so|that's ridiculous|grow up)\b/i;
    for (const i of INTERVENTIONS) {
      const text = [...i.script, i.closing].join(" ");
      assert.doesNotMatch(text, shaming, `${i.id} shames the reader`);
    }
  });
});
