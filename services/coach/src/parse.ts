/**
 * Parses the model's raw text into a message and its suggestion buttons.
 *
 * The model is asked for a trailing `SUGGESTIONS:` line. It will sometimes
 * forget, number them, wrap them in markdown, or put them first. All of that is
 * handled here so the UI receives one shape and never renders a stray marker.
 */

import { SUGGESTIONS_MARKER } from "./prompt.ts";

export type ParsedReply = { message: string; suggestions: string[] };

/** Cap from `CoachReplySchema`: four buttons, sixty characters each. */
const MAX_SUGGESTIONS = 4;
const MAX_SUGGESTION_LENGTH = 60;

export function parseReply(raw: string): ParsedReply {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");

  const markerIndex = lines.findIndex((l) =>
    l.trim().toLowerCase().startsWith(SUGGESTIONS_MARKER.toLowerCase()),
  );

  if (markerIndex === -1) {
    return { message: cleanMessage(text), suggestions: [] };
  }

  const markerLine = lines[markerIndex]!;
  const after = markerLine.slice(markerLine.toLowerCase().indexOf(SUGGESTIONS_MARKER.toLowerCase()) + SUGGESTIONS_MARKER.length);

  // Anything after the marker line is dropped: the format says it comes last,
  // and trailing model chatter is not a message a teen should see.
  const message = cleanMessage(lines.slice(0, markerIndex).join("\n"));

  return { message, suggestions: parseSuggestions(after) };
}

function parseSuggestions(raw: string): string[] {
  return raw
    .split(/\||;|(?:^|\s)\d+[.)]\s+/)
    .map((s) =>
      s
        .replace(/^[\s\-*•]+/, "")
        .replace(/[\s.]+$/, "")
        .replace(/^["'`]|["'`]$/g, "")
        .trim(),
    )
    .filter((s) => s.length >= 2 && s.length <= MAX_SUGGESTION_LENGTH)
    .slice(0, MAX_SUGGESTIONS);
}

/** Strips markdown scaffolding a chat bubble should never render. */
function cleanMessage(text: string): string {
  return text
    .replace(/^```[a-z]*\n?|```$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
