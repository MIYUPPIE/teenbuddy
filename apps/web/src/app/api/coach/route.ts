/**
 * The coach endpoint.
 *
 * Server-side for two reasons that are not negotiable:
 *   - `@teenbuddy/llm` spawns the local Claude Code CLI. That cannot happen in
 *     a browser, and it must not: the CLI has the machine's credentials.
 *   - The safety gate must run somewhere a client cannot skip. A browser can
 *     call any endpoint with any payload, so the gate lives behind this route
 *     and every reply is assessed here, not in the page that renders it.
 */

import { NextResponse } from "next/server";
import { CoachRequestSchema } from "@teenbuddy/contracts";
import { respond } from "@teenbuddy/coach";
import { asComplete, createClient } from "@teenbuddy/llm";
import { assessSync } from "@teenbuddy/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const parsed = CoachRequestSchema.parse(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "That request did not match the expected shape.", issues: parsed.errors },
      { status: 400 },
    );
  }

  const client = createClient();
  const availability = await client.available();

  try {
    const result = await respond(parsed.value, {
      // No model available means templates only. That is a degraded experience,
      // never an unsafe one: the deterministic safety tier still runs.
      ...(availability.ok ? { llm: asComplete(client) } : {}),
      regionCode: parsed.value.regionCode ?? null,
      timeoutMs: 30_000,
    });

    return NextResponse.json({
      reply: result.reply,
      modelAvailable: availability.ok,
      ...(result.modelTierError ? { safetyModelDegraded: true } : {}),
    });
  } catch {
    // A crash must not leave a teenager with a spinner. Fall back to the
    // deterministic assessment, which needs nothing but the text.
    const fallback = assessSync(parsed.value.message, parsed.value.topic, parsed.value.regionCode);
    return NextResponse.json(
      {
        reply: {
          message:
            fallback.escalation?.message ??
            "Something went wrong at my end, not yours. Do you want to try saying that again?",
          suggestions: fallback.suggestions.length ? fallback.suggestions : ["Try again", "Talk to someone I trust"],
          riskLevel: fallback.verdict.level,
          ...(fallback.escalation ? { escalation: fallback.escalation } : {}),
          source: "template",
        },
        modelAvailable: false,
      },
      { status: 200 },
    );
  }
}
