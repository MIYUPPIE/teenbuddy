/**
 * @teenbuddy/safety - the gate every teen message passes through.
 *
 * The contract with the rest of the app is short:
 *
 *   Nothing reaches the coach model, and nothing reaches a screen, without an
 *   assessment. At `crisis`, the coach model is not called at all and a
 *   reviewed template is rendered instead.
 *
 * Ordering is the whole design. Tier 1 is deterministic and always runs, so the
 * explicit cases are handled with no network, no latency and no variance. Tier
 * 2 is a model and can only raise the result. There is no path in which a model
 * failure, a timeout, or a prompt injection lowers a risk level.
 */

import {
  isEmergencyTopic, maxRisk, riskRank,
  type Escalation, type HelpTopic, type SafetySignal, type SafetyVerdict,
} from "@teenbuddy/contracts";
import { classifyDeterministic, declaredEmergency, toVerdict } from "./tier1.ts";
import { classifyWithModel, type LlmComplete } from "./tier2.ts";
import { isSubstantive } from "./normalize.ts";
import { buildEscalation, escalationSuggestions, reasonFor, BOUNDARY_DISCLAIMER } from "./templates.ts";

export * from "./normalize.ts";
export * from "./lexicon.ts";
export * from "./tier1.ts";
export * from "./tier2.ts";
export * from "./resources.ts";
export * from "./templates.ts";

export type AssessInput = {
  /** Raw text as the teen typed it. */
  text: string;
  /** Set when they arrived from a Help Now topic. `not_safe` is an emergency by itself. */
  topic?: HelpTopic;
  /** ISO-3166 alpha-2. Wrong or missing still yields the international directory. */
  regionCode?: string | null;
  /**
   * The model tier. Omit to run tier 1 only - which is a complete, safe
   * assessment, just with less coverage of veiled risk.
   */
  llm?: LlmComplete;
  timeoutMs?: number;
};

export type Assessment = {
  verdict: SafetyVerdict;
  /** Present whenever the level is `elevated` or `crisis`. */
  escalation: Escalation | null;
  /** Buttons to render beside the reply. */
  suggestions: string[];
  /**
   * True when the coach must NOT send this message to a model and must render
   * `escalation.message` verbatim instead.
   */
  blockModel: boolean;
  /** Set when the model tier failed. The assessment is still valid. */
  modelTierError?: string;
};

/**
 * Assess one message.
 *
 * Never throws. A failure anywhere in the model tier degrades to the
 * deterministic result rather than propagating, because the caller of this
 * function is a teenager waiting for a reply.
 */
export async function assess(input: AssessInput): Promise<Assessment> {
  // A tap on "I don't feel safe" is a declaration, not a sentence to analyse.
  const tier1 = input.topic && isEmergencyTopic(input.topic)
    ? declaredEmergency()
    : classifyDeterministic(input.text);

  const signals: SafetySignal[] = [...tier1.signals];
  const tiers: ("deterministic" | "model")[] = ["deterministic"];
  let level = tier1.level;
  let modelTierError: string | undefined;

  // Skip the model when it cannot change the outcome or has nothing to work
  // with: already crisis, no provider, or too short to carry veiled meaning.
  const worthAsking =
    input.llm !== undefined && tier1.level !== "crisis" && isSubstantive(input.text);

  if (worthAsking) {
    const tier2 = await classifyWithModel(input.text, input.llm!, { timeoutMs: input.timeoutMs });
    tiers.push("model");
    if (tier2.error) modelTierError = tier2.error;
    signals.push(...tier2.signals);
    // The one-way ratchet. maxRisk cannot return less than `level`.
    level = maxRisk(level, tier2.level);
  }

  const verdict = toVerdict(level, signals, tiers);
  const needsEscalation = riskRank(level) >= riskRank("elevated");

  return {
    verdict,
    escalation: needsEscalation
      ? buildEscalation(reasonFor(signals.map((s) => s.ruleId), level, input.topic), input.regionCode)
      : null,
    suggestions: needsEscalation ? escalationSuggestions(level) : [],
    blockModel: level === "crisis",
    ...(modelTierError ? { modelTierError } : {}),
  };
}

/** Tier 1 only, synchronous. For anywhere an await is not available. */
export function assessSync(text: string, topic?: HelpTopic, regionCode?: string | null): Assessment {
  const tier1 = topic && isEmergencyTopic(topic) ? declaredEmergency() : classifyDeterministic(text);
  const verdict = toVerdict(tier1.level, tier1.signals, ["deterministic"]);
  const needsEscalation = riskRank(tier1.level) >= riskRank("elevated");
  return {
    verdict,
    escalation: needsEscalation
      ? buildEscalation(reasonFor(tier1.signals.map((s) => s.ruleId), tier1.level, topic), regionCode)
      : null,
    suggestions: needsEscalation ? escalationSuggestions(tier1.level) : [],
    blockModel: tier1.level === "crisis",
  };
}

export { BOUNDARY_DISCLAIMER };
