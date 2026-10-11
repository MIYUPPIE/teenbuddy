/**
 * @teenbuddy/coach - the Teen Support Coach.
 *
 * The whole service is one guarantee, and the ordering is the guarantee:
 *
 *   assess -> [crisis? render a reviewed template and STOP] -> model -> check -> assess again
 *
 * A crisis reply is never generated. The safety gate runs before the model is
 * called, and at `crisis` the model is not called at all: `CoachReplySchema`
 * refuses `source: "model"` at that level, so an improvised crisis response
 * cannot even be constructed, let alone rendered.
 *
 * The second assessment is on the model's own output. A reply that would itself
 * raise the risk level is replaced rather than sent.
 */

import {
  CoachReplySchema, expect as expectValid,
  type CoachReply, type CoachRequest, type SafetyVerdict,
} from "@teenbuddy/contracts";
import {
  BOUNDARY_DISCLAIMER, assess, assessSync, escalationSuggestions,
  type Assessment, type LlmComplete,
} from "@teenbuddy/safety";
import { COACH_SYSTEM, buildPrompt } from "./prompt.ts";
import { checkReply, mustReplace, stripViolations, type Violation } from "./check.ts";
import { parseReply } from "./parse.ts";

export * from "./prompt.ts";
export * from "./check.ts";
export * from "./parse.ts";

/** Shown when the model is unavailable, unusable, or said something disallowed. */
export const FALLBACK_MESSAGE =
  "I'm here, and I read what you wrote. I'm having trouble finding the right words right now, " +
  "which is on me and not on you. Do you want to tell me a bit more about what happened?";

const FALLBACK_SUGGESTIONS = ["Tell me more", "Something that helps", "Talk to someone I trust"];

export type CoachOptions = {
  /** Omit to run entirely on templates: safe, useful, and free. */
  llm?: LlmComplete;
  regionCode?: string | null;
  timeoutMs?: number;
};

export type CoachResult = {
  reply: CoachReply;
  verdict: SafetyVerdict;
  /** Why a model reply was rejected, when it was. Never shown to a teen. */
  violations: Violation[];
  /** Present when the model tier of the safety gate failed. */
  modelTierError?: string;
};

/**
 * Produce one coach turn.
 *
 * Never throws and never returns without a reply. Every failure mode - no
 * provider, a timeout, malformed output, a disallowed reply - resolves to
 * something a teenager can read.
 */
export async function respond(
  request: CoachRequest,
  options: CoachOptions = {},
): Promise<CoachResult> {
  const assessment = await assess({
    text: request.message,
    ...(request.topic ? { topic: request.topic } : {}),
    regionCode: options.regionCode ?? request.regionCode ?? null,
    ...(options.llm ? { llm: options.llm } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });

  // The model is never consulted at crisis level.
  if (assessment.blockModel) return templateResult(assessment);

  if (!options.llm) return templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS);

  let raw: string;
  try {
    const response = await options.llm({
      system: COACH_SYSTEM,
      prompt: buildPrompt(request),
      expectJson: false,
      maxTokens: 600,
      ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    });
    raw = typeof response?.text === "string" ? response.text : "";
  } catch {
    return templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS);
  }

  const parsed = parseReply(raw);
  if (!parsed.message.trim()) {
    return templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS);
  }

  const violations = checkReply(parsed.message);
  if (mustReplace(violations)) {
    return { ...templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS), violations };
  }

  const cleaned = stripViolations(parsed.message, violations);
  if (!cleaned.trim()) {
    return { ...templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS), violations };
  }

  // Second gate: the reply itself is assessed. A model that answers a sad
  // message with something that reads as crisis content does not get to send it.
  const outputRisk = assessSync(cleaned);
  if (outputRisk.blockModel) {
    return { ...templateResult(assessment, FALLBACK_MESSAGE, FALLBACK_SUGGESTIONS), violations };
  }

  const suggestions =
    assessment.escalation !== null
      ? escalationSuggestions(assessment.verdict.level)
      : parsed.suggestions.length > 0
        ? parsed.suggestions
        : FALLBACK_SUGGESTIONS;

  const reply: CoachReply = {
    message: truncate(cleaned, 2000),
    suggestions: suggestions.slice(0, 4),
    riskLevel: assessment.verdict.level,
    ...(assessment.escalation ? { escalation: assessment.escalation } : {}),
    source: "model",
  };

  return {
    reply: expectValid(CoachReplySchema, reply),
    verdict: assessment.verdict,
    violations,
    ...(assessment.modelTierError ? { modelTierError: assessment.modelTierError } : {}),
  };
}

/** Builds a reply with `source: "template"`, the only kind valid at crisis. */
function templateResult(
  assessment: Assessment,
  message?: string,
  suggestions?: string[],
): CoachResult {
  const body = assessment.escalation?.message ?? message ?? FALLBACK_MESSAGE;
  const buttons =
    assessment.suggestions.length > 0
      ? assessment.suggestions
      : (suggestions ?? FALLBACK_SUGGESTIONS);

  const reply: CoachReply = {
    message: truncate(body, 2000),
    suggestions: buttons.slice(0, 4),
    riskLevel: assessment.verdict.level,
    ...(assessment.escalation ? { escalation: assessment.escalation } : {}),
    source: "template",
  };

  return {
    reply: expectValid(CoachReplySchema, reply),
    verdict: assessment.verdict,
    violations: [],
    ...(assessment.modelTierError ? { modelTierError: assessment.modelTierError } : {}),
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export { BOUNDARY_DISCLAIMER };
