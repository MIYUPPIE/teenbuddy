/**
 * Crisis resources.
 *
 * ⚠️ These numbers must be verified against the operating authority in each
 * region before this ships to a real teenager, and re-verified on a schedule.
 * A wrong number in a crisis is worse than no number. `LAST_VERIFIED` records
 * when a human last checked; a gate test fails if it goes stale.
 *
 * Two rules hold everywhere:
 *   - The international directory is appended to EVERY region, so an unknown
 *     or wrong `regionCode` can never produce an empty list.
 *   - Every region includes a route that works without credit, without an
 *     account, and (where possible) by text - a teen who cannot safely make a
 *     phone call is the normal case, not the edge case.
 */

/** ISO date a human last checked these against the operators. */
export const LAST_VERIFIED = "2026-08-31";

/** Verification is due this many days after LAST_VERIFIED. */
export const VERIFY_EVERY_DAYS = 180;

export type CrisisResource = {
  name: string;
  contact: string;
  regionCode: string;
  note?: string;
};

/**
 * Always appended. `findahelpline.com` resolves the caller's own country, which
 * makes it the correct answer for every region this table does not cover.
 */
export const INTERNATIONAL: readonly CrisisResource[] = [
  {
    name: "Find a Helpline",
    contact: "findahelpline.com",
    regionCode: "XX",
    note: "Free, confidential helplines in your own country.",
  },
  {
    name: "Local emergency services",
    contact: "Your local emergency number",
    regionCode: "XX",
    note: "If you are in immediate danger.",
  },
];

const BY_REGION: Record<string, readonly CrisisResource[]> = {
  US: [
    { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", regionCode: "US", note: "24/7, free." },
    { name: "Crisis Text Line", contact: "Text HOME to 741741", regionCode: "US", note: "Text only, if calling is not safe." },
    { name: "Emergency services", contact: "911", regionCode: "US" },
  ],
  GB: [
    { name: "Samaritans", contact: "Call 116 123", regionCode: "GB", note: "24/7, free, no caller ID." },
    { name: "Shout", contact: "Text SHOUT to 85258", regionCode: "GB", note: "Text only, 24/7." },
    { name: "Childline", contact: "Call 0800 1111", regionCode: "GB", note: "Free and confidential, under 19." },
    { name: "Emergency services", contact: "999", regionCode: "GB" },
  ],
  CA: [
    { name: "9-8-8 Suicide Crisis Helpline", contact: "Call or text 988", regionCode: "CA", note: "24/7, English and French." },
    { name: "Kids Help Phone", contact: "Call 1-800-668-6868 or text CONNECT to 686868", regionCode: "CA" },
    { name: "Emergency services", contact: "911", regionCode: "CA" },
  ],
  AU: [
    { name: "Lifeline", contact: "Call 13 11 14", regionCode: "AU", note: "24/7." },
    { name: "Kids Helpline", contact: "Call 1800 55 1800", regionCode: "AU", note: "Ages 5-25, 24/7." },
    { name: "Emergency services", contact: "000", regionCode: "AU" },
  ],
  IE: [
    { name: "Samaritans Ireland", contact: "Call 116 123", regionCode: "IE", note: "24/7, free." },
    { name: "Text About It", contact: "Text HELLO to 50808", regionCode: "IE" },
    { name: "Emergency services", contact: "112 or 999", regionCode: "IE" },
  ],
  IN: [
    { name: "Tele-MANAS", contact: "Call 14416", regionCode: "IN", note: "Government mental health helpline, 24/7." },
    { name: "Emergency services", contact: "112", regionCode: "IN" },
  ],
  NG: [
    // Nigeria has no single verified national crisis line this file is willing
    // to hard-code. 112 is the national emergency number; the directory below
    // resolves the current NGO helplines, which change more often than this app
    // ships. Do not add a number here without verifying it with the operator.
    { name: "Emergency services", contact: "112", regionCode: "NG", note: "National emergency number." },
  ],
  ZA: [
    { name: "SADAG Suicide Crisis Line", contact: "Call 0800 567 567", regionCode: "ZA" },
    { name: "Emergency services", contact: "112", regionCode: "ZA" },
  ],
  NZ: [
    { name: "1737 Need to Talk?", contact: "Call or text 1737", regionCode: "NZ", note: "Free, 24/7." },
    { name: "Emergency services", contact: "111", regionCode: "NZ" },
  ],
};

/** Regions with a dedicated list. Everywhere else falls back to the directory. */
export const SUPPORTED_REGIONS: readonly string[] = Object.keys(BY_REGION).sort();

/**
 * Resources for a region, always non-empty.
 *
 * An unknown, missing or malformed region returns the international directory
 * rather than nothing. There is no input that produces an empty list.
 */
export function resourcesFor(regionCode?: string | null): CrisisResource[] {
  const key = (regionCode ?? "").trim().toUpperCase();
  // Cap at 6 to satisfy the Escalation contract and to stay readable in a panic.
  return [...(BY_REGION[key] ?? []), ...INTERNATIONAL].slice(0, 6);
}

/** Days until the table is due for re-verification. Negative means overdue. */
export function daysUntilVerificationDue(today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${LAST_VERIFIED}T00:00:00Z`);
  return VERIFY_EVERY_DAYS - Math.floor(ms / 86_400_000);
}
