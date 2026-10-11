/**
 * Tier 1: the deterministic classifier.
 *
 * Always runs, on every message, before anything else. Free, instant, offline,
 * and identical on every call. Nothing downstream can lower what it decides.
 *
 * Pipeline:
 *   normalise -> blank idioms -> match rules -> apply guards -> take the max
 */

import { maxRisk, riskRank, type RiskLevel, type SafetySignal, type SafetyVerdict } from "@teenbuddy/contracts";
import { FIRST_PERSON_RULES, GUARDS, GUARD_WINDOW, IDIOMS, RULES, THIRD_PARTY_SUBJECT } from "./lexicon.ts";
import { normalize, type Normalized } from "./normalize.ts";

/** Replaces idiom spans with spaces, preserving offsets so guards stay aligned. */
function blankIdioms(text: string): string {
  let out = text;
  for (const idiom of IDIOMS) {
    out = out.replace(new RegExp(idiom.source, "g"), (m) => " ".repeat(m.length));
  }
  return out.replace(/\s+/g, " ").trim();
}

function blankAll(n: Normalized): Normalized {
  const forms = [...new Set(n.forms.map(blankIdioms))].filter(Boolean);
  return {
    text: forms[0] ?? "",
    forms,
    squeezed: [...new Set(forms.map((f) => f.replace(/[^a-z]/g, "")))],
  };
}

/** Which guard, if any, applies to a match at `index` in `text`. */
function guardFor(text: string, index: number): string | null {
  const window = text.slice(Math.max(0, index - GUARD_WINDOW), index);
  for (const g of GUARDS) if (g.pattern.test(window)) return g.id;
  return null;
}

/** True when the words right before a match name someone other than the teen. */
function isThirdPartySubject(text: string, index: number): boolean {
  return THIRD_PARTY_SUBJECT.test(text.slice(Math.max(0, index - 40), index));
}

const downgrade = (level: RiskLevel): RiskLevel =>
  level === "crisis" ? "elevated" : level === "elevated" ? "concern" : level;

export type Tier1Result = {
  level: RiskLevel;
  signals: SafetySignal[];
  /** Guards that fired, for the eval report. Not shown to a teen. */
  guardsApplied: string[];
};

/**
 * Classify a message on deterministic rules alone.
 *
 * @param input raw text as the teen typed it.
 */
export function classifyDeterministic(input: string): Tier1Result {
  const cleaned = blankAll(normalize(input));
  const signals: SafetySignal[] = [];
  const guardsApplied: string[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      // Readable forms carry offsets that guards can use; squeezed forms do not,
      // so a squeezed-only hit is treated as unguarded.
      let hit: { evidence: string; guard: string | null } | null = null;

      for (const form of cleaned.forms) {
        const m = pattern.exec(form);
        if (!m) continue;
        // Re-attribution, not suppression: `third-party-risk` still fires on
        // the same text and carries the disclosure at `elevated`.
        if (FIRST_PERSON_RULES.includes(rule.id) && isThirdPartySubject(form, m.index)) continue;
        hit = {
          evidence: m[0].slice(0, 120),
          guard: rule.guardable ? guardFor(form, m.index) : null,
        };
        break;
      }

      if (!hit) {
        for (const form of cleaned.squeezed) {
          const m = pattern.exec(form);
          if (!m) continue;
          hit = { evidence: m[0].slice(0, 120), guard: null };
          break;
        }
      }

      if (!hit) continue;

      const level = hit.guard ? downgrade(rule.level) : rule.level;
      if (hit.guard) guardsApplied.push(`${rule.id}:${hit.guard}`);
      signals.push({ ruleId: rule.id, level, evidence: hit.evidence });
      break; // one signal per rule is enough
    }
  }

  return {
    level: maxRisk(...signals.map((s) => s.level)),
    signals,
    guardsApplied: [...new Set(guardsApplied)],
  };
}

/**
 * A teen tapping "I don't feel safe" is a declared emergency. No text analysis,
 * no model, no ambiguity: the tap *is* the signal.
 */
export function declaredEmergency(): Tier1Result {
  return {
    level: "crisis",
    signals: [{ ruleId: "declared-not-safe", level: "crisis", evidence: "tapped I don't feel safe" }],
    guardsApplied: [],
  };
}

/** Builds the contract-shaped verdict from one or both tiers. */
export function toVerdict(
  level: RiskLevel,
  signals: SafetySignal[],
  tiers: ("deterministic" | "model")[],
): SafetyVerdict {
  return {
    level,
    tiers,
    signals: signals.slice(0, 20),
    requiresHumanHandoff: riskRank(level) >= riskRank("elevated"),
    blocksNormalFlow: level === "crisis",
  };
}
