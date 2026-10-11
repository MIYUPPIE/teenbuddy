/**
 * The local Claude Code provider.
 *
 * TeenBuddy does not call a hosted inference endpoint. It shells out to the
 * Claude Code CLI already installed on the machine, which keeps a teenager's
 * words off a third-party API and means there is no key in this repo to leak.
 *
 * The subprocess is treated as hostile in exactly the ways a subprocess is:
 * it may hang, exit non-zero, print to stderr and still succeed, emit a JSON
 * envelope or bare text, or not exist at all. Every one of those is handled
 * here rather than by the caller.
 */

import { spawn } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LlmRequest, LlmResponse } from "@teenbuddy/contracts";
import { DEFAULT_TIMEOUT_MS, LlmError, type Provider } from "./provider.ts";

/**
 * Always the most capable model available. Never silently downgraded for cost:
 * this model reads messages from teenagers in distress, and the cheap one is
 * measurably worse at the veiled cases that matter most.
 */
export const DEFAULT_MODEL = "claude-opus-4-6";

/** Where the CLI usually lives, in priority order after $TEENBUDDY_CLAUDE_BIN and $PATH. */
const CANDIDATE_PATHS = [
  join(homedir(), ".claude", "local", "claude"),
  join(homedir(), ".local", "bin", "claude"),
  "/usr/local/bin/claude",
  "/opt/homebrew/bin/claude",
];

let cachedBin: string | null | undefined;

/** Resolves the CLI once per process. `null` means it is not installed. */
export async function resolveBinary(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (cachedBin !== undefined) return cachedBin;

  const explicit = env.TEENBUDDY_CLAUDE_BIN?.trim();
  if (explicit) {
    cachedBin = (await isExecutable(explicit)) ? explicit : null;
    return cachedBin;
  }

  const onPath = await findOnPath("claude", env);
  if (onPath) {
    cachedBin = onPath;
    return cachedBin;
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (await isExecutable(candidate)) {
      cachedBin = candidate;
      return cachedBin;
    }
  }

  cachedBin = null;
  return cachedBin;
}

/** Test seam: forget the cached lookup. */
export const resetBinaryCache = (): void => {
  cachedBin = undefined;
};

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans $PATH directly rather than shelling out to `command -v`.
 *
 * Spawning with `shell: true` concatenates arguments without escaping, which
 * Node now warns about; doing the lookup in-process avoids the shell entirely
 * and is faster besides.
 */
async function findOnPath(name: string, env: NodeJS.ProcessEnv): Promise<string | null> {
  for (const dir of (env.PATH ?? "").split(":")) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

export type RunResult = { stdout: string; stderr: string; code: number | null; timedOut: boolean };

/** Runs the CLI with the prompt on stdin, so no user text ever lands in argv. */
export function runCli(
  bin: string,
  args: string[],
  stdin: string,
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => { stdout += d; });
    child.stderr.on("data", (d: string) => { stderr += d; });

    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new LlmError(`could not start ${bin}`, "unavailable", e.message));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });

    child.stdin.on("error", () => { /* closed early; the exit code tells the story */ });
    child.stdin.end(stdin);
  });
}

/**
 * Reads whatever the CLI printed.
 *
 * `--output-format json` yields an envelope with a `result` field, but a CLI
 * upgrade, a warning line, or a plain-text fallback all have to keep working,
 * so bare text is accepted too.
 */
export function parseCliOutput(stdout: string): { text: string; model?: string; inputTokens?: number; outputTokens?: number } {
  const trimmed = stdout.trim();
  if (!trimmed) return { text: "" };

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      const text =
        typeof o.result === "string" ? o.result
        : typeof o.text === "string" ? o.text
        : typeof o.content === "string" ? o.content
        : null;
      if (text !== null) {
        const usage = (o.usage ?? {}) as Record<string, unknown>;
        return {
          text,
          ...(typeof o.model === "string" ? { model: o.model } : {}),
          ...(typeof usage.input_tokens === "number" ? { inputTokens: usage.input_tokens } : {}),
          ...(typeof usage.output_tokens === "number" ? { outputTokens: usage.output_tokens } : {}),
        };
      }
    }
  } catch {
    // Not JSON. Fall through and treat it as the answer.
  }
  return { text: trimmed };
}

export type ClaudeCodeOptions = {
  model?: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam. Defaults to the real subprocess. */
  run?: typeof runCli;
};

export function claudeCodeProvider(options: ClaudeCodeOptions = {}): Provider {
  const run = options.run ?? runCli;
  const env = options.env ?? process.env;
  const model = options.model ?? env.TEENBUDDY_LLM_MODEL ?? DEFAULT_MODEL;

  return {
    id: "claude-code",

    async available() {
      const bin = await resolveBinary(env);
      return bin
        ? { ok: true }
        : {
            ok: false,
            reason:
              "the Claude Code CLI was not found. Install it, or set TEENBUDDY_CLAUDE_BIN to its path.",
          };
    },

    async complete(request: LlmRequest): Promise<LlmResponse> {
      const bin = await resolveBinary(env);
      if (!bin) throw new LlmError("Claude Code CLI not found", "unavailable");

      const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const started = Date.now();

      const args = [
        "-p",
        "--output-format", "json",
        "--model", model,
        "--append-system-prompt", request.system,
      ];

      const result = await run(bin, args, request.prompt, timeoutMs);

      if (result.timedOut) {
        throw new LlmError(`Claude Code timed out after ${timeoutMs}ms`, "timeout");
      }
      if (result.code !== 0) {
        throw new LlmError(
          `Claude Code exited with code ${result.code}`,
          "failed",
          result.stderr.slice(0, 500),
        );
      }

      const parsed = parseCliOutput(result.stdout);
      if (!parsed.text.trim()) {
        throw new LlmError("Claude Code returned an empty response", "empty", result.stderr.slice(0, 200));
      }

      return {
        text: parsed.text,
        provider: "claude-code",
        durationMs: Date.now() - started,
        ...(parsed.model ? { model: parsed.model } : { model }),
        ...(parsed.inputTokens !== undefined ? { inputTokens: parsed.inputTokens } : {}),
        ...(parsed.outputTokens !== undefined ? { outputTokens: parsed.outputTokens } : {}),
      };
    },
  };
}
