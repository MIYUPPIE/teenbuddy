/**
 * Crisis and escalation responses.
 *
 * These are written once, reviewed, and rendered verbatim. **No model writes a
 * crisis reply.** `CoachReplySchema` enforces it (`source` must be `"template"`
 * at `crisis`), and this file is the only thing that can satisfy that.
 *
 * Why: at the moment that matters most, an improvised response is a coin flip.
 * A model can be prompt-injected, can hallucinate a helpline number, can time
 * out, or can be quietly swapped for a cheaper one. A constant cannot.
 *
 * The wording follows what crisis lines actually train people to do:
 *   1. Say you heard it. Do not soften it or change the subject.
 *   2. Ask directly about immediate danger. Vagueness helps nobody.
 *   3. Give one concrete next step, not a list of five.
 *   4. Stay. Do not end the conversation because a resource was shown.
 * It never says "calm down", never promises confidentiality it cannot keep, and
 * never claims to be a therapist.
 */

import { isEmergencyTopic, type Escalation, type HelpTopic, type RiskLevel } from "@teenbuddy/contracts";
import { resourcesFor } from "./resources.ts";

/** Shown wherever the coach speaks. The boundary from spec section 10. */
export const BOUNDARY_DISCLAIMER =
  "I'm here to support you, but I'm not a replacement for a parent, counselor, doctor, or emergency service.";

const CRISIS_SELF_HARM = [
  "I'm really glad you told me. What you just said matters and I'm not going to skip past it.",
  "",
  "I have to be honest with you: this is bigger than what I can help with on my own, and you deserve a real person for it.",
  "",
  "Are you safe right now, this minute?",
  "",
  "If you are in immediate danger, please contact emergency services or someone who is physically near you.",
].join("\n");

const CRISIS_DANGER = [
  "I believe you, and I'm glad you said something.",
  "",
  "Feeling unsafe is not something to handle alone, and it's not something you have to prove to anyone first.",
  "",
  "Are you somewhere safe right now?",
  "",
  "If you are in immediate danger, contact emergency services or get to someone you trust who is nearby.",
].join("\n");

const CRISIS_ABUSE = [
  "Thank you for telling me. That took something, and I want to be clear: what you're describing is not your fault.",
  "",
  "This needs an adult whose job it is to help with exactly this, and there are people who do only this and will believe you.",
  "",
  "Are you safe where you are right now?",
].join("\n");

const ELEVATED_SUPPORT = [
  "That sounds genuinely heavy, and I don't want to hand you a breathing exercise and move on.",
  "",
  "You don't have to be in an emergency to deserve someone to talk to.",
  "",
  "Is there a person in your life you could tell some of this to? It doesn't have to be all of it.",
].join("\n");

export type EscalationReason = Escalation["reason"];

/**
 * Picks the reason from the rules that fired, in severity order.
 *
 * `level` is required because the model tier can return `crisis` with no
 * deterministic rule behind it - a veiled farewell matches no lexicon entry.
 * Falling through to `beyond_scope` there would render the *elevated* template
 * to a teen in crisis, so a crisis with no named rule takes the crisis default.
 */
export function reasonFor(
  ruleIds: readonly string[],
  level: RiskLevel,
  topic?: HelpTopic,
): EscalationReason {
  if (topic && isEmergencyTopic(topic)) return "immediate_danger";
  if (ruleIds.some((r) => r === "abuse-disclosure")) return "abuse";
  if (ruleIds.some((r) => r === "immediate-danger")) return "immediate_danger";
  if (ruleIds.some((r) => r.startsWith("self-harm"))) return "self_harm";
  return level === "crisis" ? "self_harm" : "beyond_scope";
}

const MESSAGE_BY_REASON: Record<EscalationReason, string> = {
  self_harm: CRISIS_SELF_HARM,
  immediate_danger: CRISIS_DANGER,
  abuse: CRISIS_ABUSE,
  beyond_scope: ELEVATED_SUPPORT,
};

/**
 * Builds the escalation block.
 *
 * `offerTrustedPersonHandoff` is always true: the one-tap route to a person the
 * teen already chose is the single most useful thing on the screen, and spec
 * section 9 is explicit that it beats trying to make the AI solve everything.
 */
export function buildEscalation(
  reason: EscalationReason,
  regionCode?: string | null,
): Escalation {
  return {
    reason,
    message: MESSAGE_BY_REASON[reason],
    resources: resourcesFor(regionCode),
    offerTrustedPersonHandoff: true,
  };
}

/** The suggestion buttons beside a crisis or elevated reply. */
export function escalationSuggestions(level: RiskLevel): string[] {
  return level === "crisis"
    ? ["Yes, I'm safe", "No, I'm not safe", "Tell someone I trust"]
    : ["Tell someone I trust", "Keep talking", "Show me something calming"];
}
