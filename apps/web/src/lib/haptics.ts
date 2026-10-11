/**
 * Haptic feedback.
 *
 * A short buzz on tap is most of why a web app feels native on Android. Kept
 * deliberately tiny - 8 to 22ms - because anything longer reads as a
 * notification rather than a confirmation.
 *
 * Guarded three ways: the API may not exist (iOS Safari does not implement it),
 * it throws inside cross-origin iframes, and a user who has asked for reduced
 * motion has asked not to be buzzed at either.
 */

type Strength = "tap" | "select" | "success" | "warn";

const PATTERNS: Record<Strength, number | number[]> = {
  tap: 8,
  select: 14,
  success: [14, 40, 22],
  warn: [22, 60, 22],
};

function allowed(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function buzz(strength: Strength = "tap"): void {
  if (!allowed()) return;
  try {
    navigator.vibrate(PATTERNS[strength]);
  } catch {
    // Blocked by permissions policy. Not worth surfacing.
  }
}
