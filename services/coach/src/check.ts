/**
 * Deterministic checks on what the model wrote.
 *
 * A prompt is a request, not a guarantee. Every hard rule in `COACH_SYSTEM` is
 * re-checked here, in code, because the cost of a model diagnosing a teenager
 * once in a thousand replies is not a rounding error.
 *
 * Violations are graded, and the grade decides the response:
 *   - `strip`   - remove the offending sentence, keep the rest.
 *   - `replace` - the reply is unsalvageable; fall back to a safe template.
 */

export type Violation = {
  id: string;
  severity: "strip" | "replace";
  evidence: string;
};

type Check = { id: string; severity: "strip" | "replace"; pattern: RegExp; describes: string };

const CHECKS: readonly Check[] = [
  {
    id: "diagnosis",
    severity: "replace",
    describes: "naming a condition the teen has",
    pattern:
      /\byou (?:have|are suffering from|are experiencing|probably have|might have|sound like you have|clearly have)\b[^.!?]{0,40}\b(?:depression|depressed|anxiety disorder|generalised anxiety|adhd|add\b|ocd|ptsd|bipolar|an eating disorder|anorexia|bulimia|autism|autistic|bpd|psychosis|schizophrenia)\b/i,
  },
  {
    id: "diagnosis-label",
    severity: "replace",
    describes: "labelling the teen with a condition",
    pattern: /\b(?:you(?:'re| are) (?:clinically|definitely|obviously)) (?:depressed|anxious|bipolar|autistic)\b/i,
  },
  {
    id: "claims-clinician",
    severity: "replace",
    describes: "claiming to be a clinician",
    pattern: /\b(?:as|i am|i'm) your (?:therapist|counsell?or|doctor|psychiatrist|psychologist)\b/i,
  },
  {
    id: "promises-secrecy",
    severity: "replace",
    describes: "promising confidentiality it cannot keep",
    pattern:
      /\b(?:this (?:stays|will stay) between us|i (?:won't|will not) tell anyone|your secret is safe|nobody (?:else )?(?:will|needs to) know)\b/i,
  },
  {
    id: "medical-advice",
    severity: "replace",
    describes: "medication or dosage advice",
    pattern: /\b(?:take|stop taking|increase|double|skip) (?:your |the |a )?(?:dose|dosage|medication|meds|pills|tablets|antidepressants)\b/i,
  },
  {
    id: "calm-down",
    severity: "strip",
    describes: "telling a teen to calm down",
    pattern: /\b(?:just )?(?:calm down|relax|chill out|take a chill pill|you(?:'re| are) overreacting|don't be (?:silly|dramatic))\b/i,
  },
  {
    id: "minimising",
    severity: "strip",
    describes: "minimising the feeling",
    pattern:
      /\b(?:at least you|other people have it (?:much )?worse|it(?:'s| is) not that bad|you(?:'ll| will) get over it|first world problem)\b/i,
  },
  {
    id: "false-reassurance",
    severity: "strip",
    describes: "promising an outcome it cannot know",
    pattern:
      /\b(?:everything (?:will be|is going to be) (?:fine|ok|okay|alright)|it(?:'ll| will) all work out|everything happens for a reason)\b/i,
  },
  {
    id: "asks-identity",
    severity: "strip",
    describes: "asking for identifying details",
    pattern:
      /\bwhat(?:'s| is) your (?:full name|surname|last name|address|postcode|zip code|phone number|school called)\b/i,
  },
  {
    id: "fake-empathy",
    severity: "strip",
    describes: "the banned empathy filler",
    pattern: /\bi understand (?:exactly )?how you (?:feel|are feeling)\b/i,
  },
];

/** Runs every check. Returns violations in the order they were found. */
export function checkReply(text: string): Violation[] {
  const out: Violation[] = [];
  for (const c of CHECKS) {
    const m = c.pattern.exec(text);
    if (m) out.push({ id: c.id, severity: c.severity, evidence: m[0].slice(0, 120) });
  }
  return out;
}

export const CHECK_IDS: readonly string[] = CHECKS.map((c) => c.id);

/** True when at least one violation makes the whole reply unusable. */
export const mustReplace = (violations: readonly Violation[]): boolean =>
  violations.some((v) => v.severity === "replace");

/**
 * Removes sentences containing a strippable violation.
 *
 * Sentence-level rather than phrase-level: cutting "calm down" out of
 * "you should calm down and breathe" leaves a fragment that reads as broken
 * software, which is its own kind of alarming.
 */
export function stripViolations(text: string, violations: readonly Violation[]): string {
  const strippable = violations.filter((v) => v.severity === "strip");
  if (strippable.length === 0) return text;

  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !strippable.some((v) => s.toLowerCase().includes(v.evidence.toLowerCase())),
  );
  return kept.join(" ").replace(/\s+/g, " ").trim();
}
