import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../src/lexicon.ts";
import { classifyDeterministic, declaredEmergency } from "../src/tier1.ts";
import { isSubstantive, matchesAny, normalize } from "../src/normalize.ts";

const level = (s: string) => classifyDeterministic(s).level;
const rules = (s: string) => classifyDeterministic(s).signals.map((x) => x.ruleId);

describe("normalize", () => {
  test("expands contractions with and without apostrophes", () => {
    assert.equal(normalize("I don't want to").text, "i do not want to");
    assert.equal(normalize("I dont want to").text, "i do not want to");
    assert.equal(normalize("Don’t worry").text, "do not worry");
    assert.equal(normalize("I can't cope").text, "i can not cope");
  });

  test("collapses stretched words without breaking real doubles", () => {
    assert.equal(normalize("sooooo tired").text, "soo tired");
    assert.match(normalize("kill").text, /kill/, "the double l survives");
  });

  test("strips accents", () => {
    assert.match(normalize("I want to díe").text, /\bdie\b/);
  });

  test("keeps both readings of an ambiguous character", () => {
    const n = normalize("k1ll myse1f");
    assert.ok(n.forms.some((f) => f.includes("kill myself")), "1 must also read as l");
  });

  test("leaves crisis phone numbers intact", () => {
    // If leet substitution touched these, the app would print a broken number
    // on the one screen where being wrong is unacceptable.
    for (const num of ["988", "741741", "116 123", "0800 1111", "13 11 14"]) {
      assert.ok(normalize(`call ${num} now`).text.includes(num), `mangled ${num}`);
    }
  });

  test("matchesAny checks readable and squeezed forms", () => {
    assert.equal(matchesAny(normalize("k.i.l.l m y s e l f"), /killmyself/), true);
    assert.equal(matchesAny(normalize("hello there friend"), /killmyself/), false);
  });

  test("isSubstantive gates the model call", () => {
    assert.equal(isSubstantive("ok"), false);
    assert.equal(isSubstantive("hi"), false);
    assert.equal(isSubstantive("😔😔😔"), false);
    assert.equal(isSubstantive("i feel really awful today"), true);
  });
});

describe("tier 1 catches explicit risk", () => {
  const crisisCases = [
    "I want to kill myself",
    "I'm going to end my life tonight",
    "i want to die",
    "I wish I was dead",
    "everyone is better off dead without me",
    "I don't want to be here anymore",
    "I am suicidal",
    "thinking about taking my own life",
    "I'm going to overdose",
    "I've been cutting myself",
    "I cut myself last night",
    "i self harm",
    "I'm not safe",
    "I don't feel safe at home",
    "my dad hits me",
    "he touched me",
    "they are going to hurt me",
    "I'm scared to go home",
  ];

  for (const text of crisisCases) {
    test(`crisis: ${JSON.stringify(text)}`, () => {
      assert.equal(level(text), "crisis", `rules fired: ${rules(text).join(",") || "none"}`);
    });
  }

  test("catches shorthand", () => {
    assert.equal(level("kms"), "crisis");
  });

  test("catches obfuscated spellings", () => {
    assert.equal(level("i want to k1ll myse1f"), "crisis");
    assert.equal(level("k.i.l.l  m.y.s.e.l.f"), "crisis");
    assert.equal(level("I want to unalive myself"), "crisis");
    assert.equal(level("i want to diiiiie"), "crisis");
  });

  test("catches it inside a longer message", () => {
    const long =
      "school was fine today and I saw my friends at lunch and we talked about the trip " +
      "but honestly none of it matters because I want to kill myself and I have for weeks";
    assert.equal(level(long), "crisis");
  });
});

describe("tier 1 grades lesser risk correctly", () => {
  test("hopelessness without intent is elevated, not crisis", () => {
    for (const t of [
      "everyone would be better without me",
      "I hate myself",
      "I'm worthless",
      "nothing matters anymore",
      "there's no point in trying anymore",
      "I can't go on",
      "nobody would notice",
    ]) {
      assert.equal(level(t), "elevated", `"${t}" -> ${level(t)}`);
    }
  });

  test("acute distress is concern", () => {
    for (const t of [
      "I'm having a panic attack",
      "I can't stop crying",
      "I feel so overwhelmed",
      "I'm falling apart",
    ]) {
      assert.equal(level(t), "concern", `"${t}" -> ${level(t)}`);
    }
  });

  test("a friend at risk is elevated and named as such", () => {
    const r = classifyDeterministic("my friend wants to die and I don't know what to do");
    assert.equal(r.level, "elevated");
    assert.ok(r.signals.some((s) => s.ruleId === "third-party-risk"));
  });
});

describe("tier 1 does not cry wolf", () => {
  const safeCases = [
    "my feet are killing me",
    "that exam killed me",
    "you killed it in the match today",
    "I'm dying to know what happened",
    "dying of laughter at this",
    "bored to death in maths",
    "I'm dead tired",
    "this deadline is stressing me out",
    "I could kill for a burger",
    "she's drop dead gorgeous",
    "let's hang out later",
    "hang on a second",
    "I cut myself shaving",
    "I accidentally cut myself on the tin",
    "I cut my hair",
    "that outfit is to die for",
    "it was career suicide",
    "I got a new killer playlist",
    "I love this song",
    "school was fine today",
    "my sister is annoying me",
    "I'm nervous about the test tomorrow",
    "I had an argument with my friend",
  ];

  for (const text of safeCases) {
    test(`no alarm: ${JSON.stringify(text)}`, () => {
      assert.equal(
        level(text),
        "none",
        `false positive from rules: ${rules(text).join(",") || "none"}`,
      );
    });
  }
});

describe("guards downgrade but never silence", () => {
  test("negation downgrades crisis to elevated, not to none", () => {
    const r = classifyDeterministic("I don't want to kill myself");
    assert.equal(r.level, "elevated", "ambivalence still deserves a human");
    assert.ok(r.guardsApplied.some((g) => g.includes("negated")));
  });

  test("past tense downgrades a disclosure but keeps it visible", () => {
    const r = classifyDeterministic("I used to cut myself but I stopped");
    assert.equal(r.level, "elevated");
    assert.ok(r.guardsApplied.some((g) => g.includes("past-tense")));
  });

  test("homework framing downgrades", () => {
    const r = classifyDeterministic("for my english essay I need a character who wants to die");
    assert.equal(r.level, "elevated");
  });

  test("a guard never reaches none from crisis", () => {
    for (const t of [
      "I don't want to kill myself",
      "I used to want to die",
      "I never want to die",
      "what if I wanted to die",
    ]) {
      assert.notEqual(level(t), "none", `"${t}" was silenced entirely`);
    }
  });

  test("guards cannot touch a declared danger or an abuse disclosure", () => {
    // These rules are guardable: false. "I don't feel safe" contains a negation
    // and must still be crisis - the negation IS the disclosure.
    assert.equal(level("I don't feel safe"), "crisis");
    assert.equal(level("I do not feel safe at home"), "crisis");
  });

  test("a guard far away from the match does not apply", () => {
    const text =
      "I do not like maths and the teacher is unfair and the room is too hot and honestly " +
      "everything about school is bad. I want to kill myself.";
    assert.equal(level(text), "crisis", "a negation 100 chars back must not downgrade");
  });
});

describe("tier 1 properties", () => {
  test("is deterministic", () => {
    const text = "I want to kill myself";
    const first = JSON.stringify(classifyDeterministic(text));
    for (let i = 0; i < 20; i++) assert.equal(JSON.stringify(classifyDeterministic(text)), first);
  });

  test("regexes are not stateful across calls", () => {
    // A /g flag on a shared RegExp makes exec() resume from lastIndex and skip
    // matches on the second call. This asserts it never happens.
    for (let i = 0; i < 5; i++) assert.equal(level("I want to kill myself"), "crisis", `call ${i}`);
  });

  test("handles empty and junk input without throwing", () => {
    for (const t of ["", "   ", "\n\n", "😔", "!!!???", "a".repeat(5000)]) {
      assert.doesNotThrow(() => classifyDeterministic(t));
    }
    assert.equal(level(""), "none");
  });

  test("evidence is an excerpt, never the whole message", () => {
    const long = `I want to kill myself. ${"x".repeat(3000)}`;
    for (const s of classifyDeterministic(long).signals) {
      assert.ok(s.evidence.length <= 120, `evidence was ${s.evidence.length} chars`);
    }
  });

  test("every rule has at least one pattern and a description", () => {
    for (const r of RULES) {
      assert.ok(r.patterns.length > 0, `${r.id} has no patterns`);
      assert.ok(r.describes.length > 10, `${r.id} has no description`);
    }
  });

  test("rule ids are unique", () => {
    assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  });

  test("is fast enough to run on every keystroke path", () => {
    const started = performance.now();
    for (let i = 0; i < 200; i++) classifyDeterministic("I had a rough day at school today honestly");
    const perCall = (performance.now() - started) / 200;
    assert.ok(perCall < 5, `${perCall.toFixed(2)}ms per call is too slow for a blocking gate`);
  });
});

describe("declaredEmergency", () => {
  test("a tap on 'I don't feel safe' is crisis with no text at all", () => {
    const r = declaredEmergency();
    assert.equal(r.level, "crisis");
    assert.equal(r.signals[0]?.ruleId, "declared-not-safe");
  });
});
