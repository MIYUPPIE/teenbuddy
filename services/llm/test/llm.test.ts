import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LlmResponseSchema } from "@teenbuddy/contracts";
import {
  DEFAULT_MODEL, LlmError, claudeCodeProvider, createClient, parseCliOutput,
  resolveBinary, resetBinaryCache, resolveProvider, stubProvider, asComplete,
  type RunResult,
} from "../src/index.ts";

const REQ = { system: "sys", prompt: "hello", expectJson: false };

/** A fake subprocess, so the whole suite is free and instant. */
const runner = (result: Partial<RunResult>, spy?: (a: string[], stdin: string) => void) =>
  (async (_bin: string, args: string[], stdin: string): Promise<RunResult> => {
    spy?.(args, stdin);
    return { stdout: "", stderr: "", code: 0, timedOut: false, ...result };
  }) as never;

beforeEach(() => resetBinaryCache());

describe("parseCliOutput", () => {
  test("reads the JSON envelope's result field", () => {
    const out = parseCliOutput(JSON.stringify({ result: "the answer", model: "claude-opus-4-6" }));
    assert.equal(out.text, "the answer");
    assert.equal(out.model, "claude-opus-4-6");
  });

  test("reads usage when the CLI reports it", () => {
    const out = parseCliOutput(JSON.stringify({ result: "x", usage: { input_tokens: 12, output_tokens: 3 } }));
    assert.equal(out.inputTokens, 12);
    assert.equal(out.outputTokens, 3);
  });

  test("omits usage rather than inventing zeros", () => {
    const out = parseCliOutput(JSON.stringify({ result: "x" }));
    assert.equal(out.inputTokens, undefined);
    assert.equal(out.outputTokens, undefined);
  });

  test("falls back to bare text when the CLI is not emitting JSON", () => {
    assert.equal(parseCliOutput("just a plain answer").text, "just a plain answer");
  });

  test("treats JSON without a known text field as text", () => {
    // A CLI upgrade that renames the field must not silently return empty.
    const raw = JSON.stringify({ unexpected: "shape" });
    assert.equal(parseCliOutput(raw).text, raw);
  });

  test("handles empty output", () => {
    assert.equal(parseCliOutput("").text, "");
    assert.equal(parseCliOutput("   \n ").text, "");
  });
});

describe("binary resolution", () => {
  test("an explicit path wins and is verified to be executable", async () => {
    assert.equal(await resolveBinary({ TEENBUDDY_CLAUDE_BIN: "/bin/echo" }), "/bin/echo");
    resetBinaryCache();
    assert.equal(await resolveBinary({ TEENBUDDY_CLAUDE_BIN: "/nope/claude" }), null);
  });

  test("a missing binary is reported as unavailable with an actionable reason", async () => {
    const status = await claudeCodeProvider({ env: { PATH: "/nonexistent" } }).available();
    assert.equal(status.ok, false);
    assert.match(status.ok === false ? status.reason : "", /TEENBUDDY_CLAUDE_BIN/);
  });

  test("the lookup is cached, then resettable for tests", async () => {
    const first = await resolveBinary({ TEENBUDDY_CLAUDE_BIN: "/bin/echo" });
    const second = await resolveBinary({ TEENBUDDY_CLAUDE_BIN: "/bin/ls" });
    assert.equal(second, first, "cached within a process");
    resetBinaryCache();
    assert.equal(await resolveBinary({ TEENBUDDY_CLAUDE_BIN: "/bin/ls" }), "/bin/ls");
  });
});

describe("claudeCodeProvider", () => {
  const env = { TEENBUDDY_CLAUDE_BIN: "/bin/echo" };

  test("returns the model's text with timing and provider id", async () => {
    const p = claudeCodeProvider({ env, run: runner({ stdout: JSON.stringify({ result: "hi there" }) }) });
    const r = await p.complete(REQ);
    assert.equal(r.text, "hi there");
    assert.equal(r.provider, "claude-code");
    assert.ok(r.durationMs >= 0);
    assert.equal(LlmResponseSchema.parse(r).ok, true);
  });

  test("passes the prompt on stdin, never in argv", async () => {
    let seenArgs: string[] = [];
    let seenStdin = "";
    const secret = "I want to kill myself";
    const p = claudeCodeProvider({
      env,
      run: runner({ stdout: "ok" }, (a, s) => { seenArgs = a; seenStdin = s; }),
    });
    await p.complete({ ...REQ, prompt: secret });
    assert.equal(seenStdin, secret);
    assert.equal(
      seenArgs.some((a) => a.includes(secret)),
      false,
      "a teen's words must not appear in a process listing",
    );
  });

  test("requests the most capable model by default", async () => {
    let seenArgs: string[] = [];
    const p = claudeCodeProvider({ env, run: runner({ stdout: "ok" }, (a) => { seenArgs = a; }) });
    await p.complete(REQ);
    const i = seenArgs.indexOf("--model");
    assert.ok(i >= 0, "a model is always named explicitly");
    assert.equal(seenArgs[i + 1], DEFAULT_MODEL);
  });

  test("sends the system prompt as a system prompt, not glued to the message", async () => {
    let seenArgs: string[] = [];
    const p = claudeCodeProvider({ env, run: runner({ stdout: "ok" }, (a) => { seenArgs = a; }) });
    await p.complete({ ...REQ, system: "SYSTEM RULES" });
    const i = seenArgs.indexOf("--append-system-prompt");
    assert.ok(i >= 0);
    assert.equal(seenArgs[i + 1], "SYSTEM RULES");
  });

  test("a timeout raises a timeout error, not a generic failure", async () => {
    const p = claudeCodeProvider({ env, run: runner({ timedOut: true, code: null }) });
    await assert.rejects(() => p.complete(REQ), (e: unknown) => {
      assert.ok(e instanceof LlmError);
      assert.equal(e.kind, "timeout");
      return true;
    });
  });

  test("a non-zero exit carries the stderr tail for debugging", async () => {
    const p = claudeCodeProvider({ env, run: runner({ code: 2, stderr: "not authenticated" }) });
    await assert.rejects(() => p.complete(REQ), (e: unknown) => {
      assert.ok(e instanceof LlmError);
      assert.equal(e.kind, "failed");
      assert.match(e.detail ?? "", /not authenticated/);
      return true;
    });
  });

  test("empty output is an error, not an empty answer", async () => {
    const p = claudeCodeProvider({ env, run: runner({ stdout: "   " }) });
    await assert.rejects(() => p.complete(REQ), (e: unknown) => {
      assert.ok(e instanceof LlmError);
      assert.equal(e.kind, "empty");
      return true;
    });
  });

  test("a missing binary fails before spawning anything", async () => {
    const p = claudeCodeProvider({ env: { PATH: "/nonexistent" }, run: runner({ stdout: "should not run" }) });
    await assert.rejects(() => p.complete(REQ), (e: unknown) => {
      assert.ok(e instanceof LlmError);
      assert.equal(e.kind, "unavailable");
      return true;
    });
  });
});

describe("createClient", () => {
  test("validates the request against the contract before spending a call", async () => {
    let called = false;
    const provider = { ...stubProvider(), complete: async () => { called = true; return { text: "x", provider: "stub", durationMs: 0 }; } };
    const client = createClient({ provider });
    await assert.rejects(() => client.complete({ system: "", prompt: "hi", expectJson: false } as never), TypeError);
    assert.equal(called, false, "a malformed request never reaches the provider");
  });

  test("applies a default timeout so no call can hang forever", async () => {
    let seen: number | undefined;
    const provider = {
      ...stubProvider(),
      complete: async (r: { timeoutMs?: number }) => {
        seen = r.timeoutMs;
        return { text: "x", provider: "stub", durationMs: 0 };
      },
    };
    await createClient({ provider: provider as never, defaultTimeoutMs: 9999 }).complete(REQ);
    assert.equal(seen, 9999);
  });

  test("retries a transient failure once", async () => {
    let attempts = 0;
    const provider = {
      ...stubProvider(),
      complete: async () => {
        attempts++;
        if (attempts === 1) throw new LlmError("flaked", "failed");
        return { text: "second time", provider: "stub", durationMs: 0 };
      },
    };
    const r = await createClient({ provider: provider as never, retries: 1 }).complete(REQ);
    assert.equal(r.text, "second time");
    assert.equal(attempts, 2);
  });

  test("never retries a timeout: the caller has already waited", async () => {
    let attempts = 0;
    const provider = {
      ...stubProvider(),
      complete: async () => { attempts++; throw new LlmError("slow", "timeout"); },
    };
    await assert.rejects(() => createClient({ provider: provider as never, retries: 3 }).complete(REQ));
    assert.equal(attempts, 1, "retrying a timeout doubles a teenager's wait");
  });

  test("never retries an unavailable provider", async () => {
    let attempts = 0;
    const provider = {
      ...stubProvider(),
      complete: async () => { attempts++; throw new LlmError("no cli", "unavailable"); },
    };
    await assert.rejects(() => createClient({ provider: provider as never, retries: 3 }).complete(REQ));
    assert.equal(attempts, 1);
  });

  test("gives up after the retry budget and rethrows the real error", async () => {
    const provider = {
      ...stubProvider(),
      complete: async () => { throw new LlmError("always down", "failed"); },
    };
    await assert.rejects(
      () => createClient({ provider: provider as never, retries: 2 }).complete(REQ),
      /always down/,
    );
  });
});

describe("resolveProvider", () => {
  test("stub is selectable for offline development", () => {
    assert.equal(resolveProvider({ env: { TEENBUDDY_LLM_PROVIDER: "stub" } }).id, "stub");
    assert.equal(resolveProvider({ env: { TEENBUDDY_LLM_PROVIDER: " STUB " } }).id, "stub");
  });

  test("defaults to the local CLI, never to a hosted API", () => {
    assert.equal(resolveProvider({ env: {} }).id, "claude-code");
    assert.equal(resolveProvider({ env: { TEENBUDDY_LLM_PROVIDER: "deepseek" } }).id, "claude-code");
  });
});

describe("stubProvider", () => {
  test("is deterministic and records what it was asked", async () => {
    const p = stubProvider();
    const a = await p.complete({ system: "safety classifier", prompt: "x", expectJson: true });
    const b = await p.complete({ system: "safety classifier", prompt: "x", expectJson: true });
    assert.equal(a.text, b.text);
    assert.equal(p.calls.length, 2);
  });

  test("asComplete adapts a client to the function safety and coach accept", async () => {
    const complete = asComplete(createClient({ provider: stubProvider() }));
    const r = await complete({ system: "safety classifier", prompt: "x", expectJson: true });
    assert.match(r.text, /"level"/);
  });
});
