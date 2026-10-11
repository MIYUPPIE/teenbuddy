import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS, CAUSES, CAUSE_LABELS, CoachReplySchema, DEFAULT_PRIVACY,
  HELP_TOPICS, HELP_TOPIC_LABELS, JournalEntrySchema, LESSON_CATEGORIES,
  LESSON_CATEGORY_LABELS, MOODS, MOOD_LABELS, MoodEntrySchema, PILLARS,
  PILLAR_LABELS, ProfileSchema, RELATIONS, RISK_LEVELS, SCHEMAS,
  SCHEMA_VERSION, SafetyVerdictSchema, SupportRequestSchema, isEmergencyTopic,
  maxRisk, moodTone, riskRank, ACHIEVEMENT_LABELS, RELATION_LABELS,
} from "../src/index.ts";

const NOW = "2026-08-31T09:00:00.000Z";

describe("enum tables", () => {
  test("every enum value has a label", () => {
    for (const m of MOODS) assert.ok(MOOD_LABELS[m]?.label, `mood ${m}`);
    for (const c of CAUSES) assert.ok(CAUSE_LABELS[c], `cause ${c}`);
    for (const t of HELP_TOPICS) assert.ok(HELP_TOPIC_LABELS[t]?.label, `topic ${t}`);
    for (const c of LESSON_CATEGORIES) assert.ok(LESSON_CATEGORY_LABELS[c]?.label, `cat ${c}`);
    for (const p of PILLARS) assert.ok(PILLAR_LABELS[p]?.label, `pillar ${p}`);
    for (const a of ACHIEVEMENTS) assert.ok(ACHIEVEMENT_LABELS[a]?.label, `achievement ${a}`);
    for (const r of RELATIONS) assert.ok(RELATION_LABELS[r], `relation ${r}`);
  });

  test("no label table has an entry for a value that was removed", () => {
    assert.deepEqual(Object.keys(MOOD_LABELS).sort(), [...MOODS].sort());
    assert.deepEqual(Object.keys(HELP_TOPIC_LABELS).sort(), [...HELP_TOPICS].sort());
    assert.deepEqual(Object.keys(PILLAR_LABELS).sort(), [...PILLARS].sort());
  });

  test("enum ids are storage-safe snake_case", () => {
    for (const v of [...MOODS, ...CAUSES, ...HELP_TOPICS, ...LESSON_CATEGORIES, ...ACHIEVEMENTS])
      assert.match(v, /^[a-z][a-z0-9_]*$/, `${v} is safe as a stored value`);
  });

  test("mood tone spans the scale and stays in range", () => {
    const tones = MOODS.map(moodTone);
    assert.ok(Math.min(...tones) >= 1 && Math.max(...tones) <= 5);
    assert.equal(moodTone("great"), 5);
    assert.equal(moodTone("lonely"), 1);
  });
});

describe("risk ordering", () => {
  test("levels are ordered least to most severe", () => {
    assert.deepEqual([...RISK_LEVELS], ["none", "concern", "elevated", "crisis"]);
    assert.ok(riskRank("crisis") > riskRank("elevated"));
    assert.ok(riskRank("elevated") > riskRank("concern"));
    assert.ok(riskRank("concern") > riskRank("none"));
  });

  test("maxRisk always escalates, never averages", () => {
    assert.equal(maxRisk("none", "crisis"), "crisis");
    assert.equal(maxRisk("crisis", "none"), "crisis", "order does not matter");
    assert.equal(maxRisk("concern", "elevated"), "elevated");
    assert.equal(maxRisk(), "none", "no signals means no risk");
    assert.equal(maxRisk("none", "none"), "none");
  });

  test("only 'not safe' is an emergency topic", () => {
    assert.equal(isEmergencyTopic("not_safe"), true);
    for (const t of HELP_TOPICS.filter((x) => x !== "not_safe"))
      assert.equal(isEmergencyTopic(t), false, t);
  });
});

describe("privacy defaults", () => {
  test("every consent starts switched off", () => {
    for (const [key, value] of Object.entries(DEFAULT_PRIVACY))
      assert.equal(value, false, `${key} must default to opt-out`);
  });
});

describe("Profile", () => {
  const valid = {
    userId: "u1",
    displayName: "Ada",
    timezone: "Africa/Lagos",
    ageBand: "13-15",
    privacy: DEFAULT_PRIVACY,
    createdAt: NOW,
    schemaVersion: SCHEMA_VERSION,
  };

  test("accepts a minimal profile", () => {
    assert.equal(ProfileSchema.parse(valid).ok, true);
  });

  test("requires a timezone the runtime can actually use", () => {
    assert.equal(ProfileSchema.parse({ ...valid, timezone: "Nowhere/Nothing" }).ok, false);
  });

  test("rejects an age band outside the product's audience", () => {
    assert.equal(ProfileSchema.parse({ ...valid, ageBand: "9-12" }).ok, false);
  });

  test("region code is two letters when present", () => {
    assert.equal(ProfileSchema.parse({ ...valid, regionCode: "NG" }).ok, true);
    assert.equal(ProfileSchema.parse({ ...valid, regionCode: "NGA" }).ok, false);
  });
});

describe("MoodEntry", () => {
  const valid = {
    id: "m1",
    userId: "u1",
    localDate: "2026-08-31",
    createdAt: NOW,
    mood: "anxious",
    causes: ["school", "exams"],
    schemaVersion: SCHEMA_VERSION,
  };

  test("accepts a multi-cause check-in", () => {
    assert.equal(MoodEntrySchema.parse(valid).ok, true);
  });

  test("requires at least one cause", () => {
    assert.equal(MoodEntrySchema.parse({ ...valid, causes: [] }).ok, false);
  });

  test('"other" without a note is rejected', () => {
    const r = MoodEntrySchema.parse({ ...valid, causes: ["other"] });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /requires a note/.test(r.errors[0]!.message));
  });

  test('"other" with a whitespace-only note is still rejected', () => {
    assert.equal(MoodEntrySchema.parse({ ...valid, causes: ["other"], note: "   " }).ok, false);
  });

  test('"other" with a real note is accepted', () => {
    assert.equal(
      MoodEntrySchema.parse({ ...valid, causes: ["other"], note: "my dog died" }).ok,
      true,
    );
  });

  test('"dont_know" cannot be combined with a specific cause', () => {
    assert.equal(MoodEntrySchema.parse({ ...valid, causes: ["dont_know", "school"] }).ok, false);
    assert.equal(MoodEntrySchema.parse({ ...valid, causes: ["dont_know"] }).ok, true);
  });

  test("rejects a timestamp where a local date belongs", () => {
    assert.equal(MoodEntrySchema.parse({ ...valid, localDate: NOW }).ok, false);
  });
});

describe("JournalEntry", () => {
  const valid = {
    id: "j1",
    userId: "u1",
    localDate: "2026-08-31",
    createdAt: NOW,
    body: "Today was hard.",
    schemaVersion: SCHEMA_VERSION,
  };

  test("accepts a long entry but rejects an empty one", () => {
    assert.equal(JournalEntrySchema.parse(valid).ok, true);
    assert.equal(JournalEntrySchema.parse({ ...valid, body: "" }).ok, false);
    assert.equal(JournalEntrySchema.parse({ ...valid, body: "x".repeat(20_000) }).ok, true);
    assert.equal(JournalEntrySchema.parse({ ...valid, body: "x".repeat(20_001) }).ok, false);
  });

  test("carries no sharing flag: a journal entry is private, full stop", () => {
    const r = JournalEntrySchema.parse({ ...valid, sharedWithParent: true });
    assert.ok(r.ok);
    assert.equal("sharedWithParent" in r.value, false);
  });
});

describe("SafetyVerdict", () => {
  test("accepts a deterministic-only verdict", () => {
    assert.equal(
      SafetyVerdictSchema.parse({
        level: "none",
        tiers: ["deterministic"],
        signals: [],
        requiresHumanHandoff: false,
        blocksNormalFlow: false,
      }).ok,
      true,
    );
  });

  test("requires at least one tier: a verdict from nowhere is invalid", () => {
    assert.equal(
      SafetyVerdictSchema.parse({
        level: "crisis",
        tiers: [],
        signals: [],
        requiresHumanHandoff: true,
        blocksNormalFlow: true,
      }).ok,
      false,
    );
  });
});

describe("CoachReply", () => {
  const base = { message: "That sounds heavy.", suggestions: ["Talk to someone"], source: "model" };
  const escalation = {
    reason: "self_harm",
    message: "I'm worried about you. Please reach a person you trust right now.",
    resources: [{ name: "Samaritans", contact: "116 123", regionCode: "GB" }],
    offerTrustedPersonHandoff: true,
  };

  test("an ordinary reply needs no escalation", () => {
    assert.equal(CoachReplySchema.parse({ ...base, riskLevel: "none" }).ok, true);
    assert.equal(CoachReplySchema.parse({ ...base, riskLevel: "concern" }).ok, true);
  });

  test("elevated risk without an escalation is rejected", () => {
    const r = CoachReplySchema.parse({ ...base, riskLevel: "elevated" });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /requires an escalation/.test(r.errors[0]!.message));
  });

  test("a crisis reply may not be model-generated", () => {
    const r = CoachReplySchema.parse({ ...base, riskLevel: "crisis", escalation });
    assert.equal(r.ok, false, "the schema itself blocks an improvised crisis reply");
    assert.ok(!r.ok && /reviewed template/.test(r.errors[0]!.message));
  });

  test("a crisis reply from a template is accepted", () => {
    assert.equal(
      CoachReplySchema.parse({ ...base, source: "template", riskLevel: "crisis", escalation }).ok,
      true,
    );
  });

  test("caps suggestions at four buttons", () => {
    const five = ["a", "b", "c", "d", "e"];
    assert.equal(CoachReplySchema.parse({ ...base, riskLevel: "none", suggestions: five }).ok, false);
  });
});

describe("SupportRequest", () => {
  test("carries only what the teen typed", () => {
    const r = SupportRequestSchema.parse({
      id: "s1",
      userId: "u1",
      trustedPersonId: "t1",
      message: "I'm having a difficult day. Can we talk?",
      urgency: "today",
      createdAt: NOW,
      journalExcerpt: "leaked private text",
      schemaVersion: SCHEMA_VERSION,
    });
    assert.ok(r.ok);
    assert.equal("journalExcerpt" in r.value, false, "no private content rides along");
  });

  test("rejects an unknown urgency", () => {
    assert.equal(
      SupportRequestSchema.parse({
        id: "s1", userId: "u1", trustedPersonId: "t1", message: "hi",
        urgency: "whenever", createdAt: NOW, schemaVersion: SCHEMA_VERSION,
      }).ok,
      false,
    );
  });
});

describe("schema registry", () => {
  test("every registered schema rejects a plainly wrong input", () => {
    for (const [name, schema] of Object.entries(SCHEMAS))
      assert.equal(schema.parse("nonsense").ok, false, `${name} accepted a bare string`);
  });

  test("SCHEMA_VERSION is semver", () => {
    assert.match(SCHEMA_VERSION, /^\d+\.\d+\.\d+$/);
  });
});
