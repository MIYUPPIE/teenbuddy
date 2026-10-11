/**
 * @teenbuddy/llm - the only module in the tree that talks to a language model.
 *
 * Two rules hold here and nowhere else has to think about them:
 *
 *   1. **No hosted inference API.** Calls go to the Claude Code CLI already on
 *      the machine. A teenager's words do not travel to a third-party endpoint,
 *      and there is no API key in this repo to leak.
 *   2. **Always the most capable model.** No silent downgrade to a cheaper one.
 *      This model reads messages from teenagers in distress and the small model
 *      is measurably worse at exactly the veiled cases that matter most.
 *
 * Adding the DeepSeek API mentioned in das.md means one new file implementing
 * `Provider` and one line in `resolveProvider`. Nothing else changes, because
 * every consumer takes a `complete` function rather than a provider.
 */

import { LlmRequestSchema, LlmResponseSchema, expect as expectValid, type LlmRequest, type LlmResponse } from "@teenbuddy/contracts";
import { claudeCodeProvider, DEFAULT_MODEL } from "./claude-code.ts";
import { LlmError, DEFAULT_TIMEOUT_MS, type Provider } from "./provider.ts";
import { stubProvider } from "./stub.ts";

export * from "./provider.ts";
export * from "./claude-code.ts";
export * from "./stub.ts";

export type ResolveOptions = { env?: NodeJS.ProcessEnv };

/**
 * Picks the provider from the environment.
 *
 * `TEENBUDDY_LLM_PROVIDER=stub` gives the deterministic one, for development
 * with no CLI installed. Anything else, including unset, gives Claude Code.
 */
export function resolveProvider(options: ResolveOptions = {}): Provider {
  const env = options.env ?? process.env;
  switch ((env.TEENBUDDY_LLM_PROVIDER ?? "claude-code").trim().toLowerCase()) {
    case "stub":
      return stubProvider();
    // case "deepseek": return deepseekProvider({ apiKey: env.DEEPSEEK_API_KEY });
    //   Not implemented. It is a hosted API, which rule 1 above forbids without
    //   an explicit decision to send teenagers' messages to a third party.
    default:
      return claudeCodeProvider({ env });
  }
}

export type ClientOptions = {
  provider?: Provider;
  /** Retries on transient failures only. Never on a timeout: the caller is waiting. */
  retries?: number;
  defaultTimeoutMs?: number;
};

export type LlmClient = {
  readonly provider: Provider;
  available(): Promise<{ ok: true } | { ok: false; reason: string }>;
  complete(request: LlmRequest): Promise<LlmResponse>;
};

/** Transient enough to be worth one more attempt. */
const RETRYABLE: ReadonlySet<string> = new Set(["failed", "empty"]);

export function createClient(options: ClientOptions = {}): LlmClient {
  const provider = options.provider ?? resolveProvider();
  const retries = options.retries ?? 1;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    provider,
    available: () => provider.available(),

    async complete(request: LlmRequest): Promise<LlmResponse> {
      const validated = expectValid(LlmRequestSchema, {
        ...request,
        timeoutMs: request.timeoutMs ?? defaultTimeoutMs,
      });

      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return expectValid(LlmResponseSchema, await provider.complete(validated));
        } catch (e) {
          lastError = e;
          const kind = e instanceof LlmError ? e.kind : "failed";
          // A timeout has already spent the caller's budget; retrying doubles
          // the wait for a teenager staring at a typing indicator.
          if (!RETRYABLE.has(kind) || attempt === retries) throw e;
        }
      }
      throw lastError;
    },
  };
}

/** The `LlmComplete` shape that `@teenbuddy/safety` and `@teenbuddy/coach` accept. */
export const asComplete = (client: LlmClient) => (request: LlmRequest) => client.complete(request);

export { DEFAULT_MODEL, DEFAULT_TIMEOUT_MS };
