/**
 * A deterministic provider for gate tests and offline development.
 *
 * Gate tests must be free, instant and never flaky, which rules out a real
 * model. This returns canned answers keyed by a substring of the prompt, so a
 * test can pin an exact model reply and assert on what the caller does with it.
 *
 * It is selectable at runtime (`TEENBUDDY_LLM_PROVIDER=stub`) so the web app
 * can be developed with no CLI installed. `isRealModel` is false, and the coach
 * refuses to present stub output as a genuine reply.
 */

import type { LlmRequest, LlmResponse } from "@teenbuddy/contracts";
import type { Provider } from "./provider.ts";

export type StubRule = { when: RegExp | string; reply: string };

/** Enough to exercise the safety and coach paths without a model. */
export const DEFAULT_STUB_RULES: StubRule[] = [
  { when: /safety classifier/i, reply: '{"level":"none","reason":"stub"}' },
  {
    when: /Teen Support Coach/i,
    reply:
      "That sounds like a lot to carry. Do you want to tell me what happened?\n" +
      "SUGGESTIONS: Tell me more | Something that helps | Talk to someone",
  },
];

export function stubProvider(rules: StubRule[] = DEFAULT_STUB_RULES): Provider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    id: "stub",
    calls,
    async available() {
      return { ok: true };
    },
    async complete(request: LlmRequest): Promise<LlmResponse> {
      calls.push(request);
      const haystack = `${request.system}\n${request.prompt}`;
      const rule = rules.find((r) =>
        typeof r.when === "string" ? haystack.includes(r.when) : r.when.test(haystack),
      );
      return {
        text: rule?.reply ?? "",
        provider: "stub",
        model: "stub",
        durationMs: 0,
      };
    },
  };
}
