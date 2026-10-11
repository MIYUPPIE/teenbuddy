/**
 * The provider contract.
 *
 * Every model call in TeenBuddy goes through this one interface, so swapping
 * the backend is a one-line change in `resolveProvider` and nothing else in the
 * tree moves. `services/safety` and `services/coach` never import a provider;
 * they take a `complete` function, which is why their gate tests are free.
 */

import type { LlmRequest, LlmResponse } from "@teenbuddy/contracts";

export type Provider = {
  /** Stable id, recorded on every response. */
  readonly id: string;
  /** Whether this provider can run right now (binary present, key set, …). */
  available(): Promise<{ ok: true } | { ok: false; reason: string }>;
  complete(request: LlmRequest): Promise<LlmResponse>;
};

export type LlmErrorKind = "unavailable" | "timeout" | "failed" | "empty";

/**
 * Thrown for a failure the caller could plausibly act on.
 *
 * Fields are declared and assigned explicitly rather than as TypeScript
 * parameter properties: those emit code, so Node's strip-only type stripping
 * rejects them and this package would not load at all.
 */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly detail: string | undefined;

  constructor(message: string, kind: LlmErrorKind, detail?: string) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.detail = detail;
  }
}

export const DEFAULT_TIMEOUT_MS = 45_000;
