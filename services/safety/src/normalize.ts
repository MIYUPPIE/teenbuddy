/**
 * Text normalisation for the deterministic classifier.
 *
 * A teen in distress is not trying to evade a filter, so this is not an
 * adversarial-robustness problem. It is a *typing* problem: phones autocorrect,
 * people write "im" and "dont", they stretch words when upset ("i cant
 * doooo this"), and characters get substituted because a keyboard is small and
 * a hand is shaking, not because anyone is being clever.
 *
 * Ambiguity is resolved by keeping every reading rather than picking one. "1"
 * is both `i` and `l`, so "myse1f" yields "myseif" *and* "myself", and a rule
 * matches if it matches any form. Guessing wrong here means missing
 * "kill myse1f", which is the one failure this file exists to prevent.
 *
 * Deliberately NOT done: stemming, and any fuzzy or edit-distance matching.
 * Both trade precision for recall, and a false crisis alarm teaches a teenager
 * that the button lies, which costs more than it saves.
 */

/** Substitutions with a single sensible reading. */
const LEET_UNAMBIGUOUS: Record<string, string> = {
  "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "+": "t",
};

/** Substitutions with two common readings. Every combination is kept. */
const LEET_AMBIGUOUS: Record<string, string[]> = {
  "1": ["i", "l"],
  "!": ["i", "l"],
  "|": ["l", "i"],
  "8": ["b", "8"],
};

const EXPANSIONS: [RegExp, string][] = [
  [/\bim\b/g, "i am"],
  [/\bive\b/g, "i have"],
  [/\bid\b/g, "i would"],
  [/\bdont\b/g, "do not"],
  [/\bcant\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bwont\b/g, "will not"],
  [/\bwouldnt\b/g, "would not"],
  [/\bshouldnt\b/g, "should not"],
  [/\bisnt\b/g, "is not"],
  [/\bwasnt\b/g, "was not"],
  [/\barent\b/g, "are not"],
  [/\bdidnt\b/g, "did not"],
  [/\bdoesnt\b/g, "does not"],
  [/\bhavent\b/g, "have not"],
  [/\bhasnt\b/g, "has not"],
  [/\baint\b/g, "am not"],
  [/\bwanna\b/g, "want to"],
  [/\bgonna\b/g, "going to"],
  [/\bgotta\b/g, "got to"],
  [/\bkms\b/g, "kill myself"],
  [/\bkys\b/g, "kill yourself"],
  [/\bunalive\b/g, "kill"],
  [/\bur\b/g, "your"],
  [/\bu\b/g, "you"],
  [/\bidk\b/g, "i do not know"],
  [/\bidc\b/g, "i do not care"],
  [/\bsh\b/g, "self harm"],
];

export type Normalized = {
  /** The primary readable form. Word boundaries intact. */
  text: string;
  /** Every readable reading, deduped. Includes `text`. */
  forms: readonly string[];
  /** Each form with non-letters stripped. Defeats "k.i.l.l" and "e n d i t". */
  squeezed: readonly string[];
};

/** Expands ambiguous characters into every combination, capped to stay cheap. */
function expandAmbiguous(s: string): string[] {
  const positions: { index: number; options: string[] }[] = [];
  for (let i = 0; i < s.length; i++) {
    const options = LEET_AMBIGUOUS[s[i]!];
    if (!options) continue;
    // Only substitute when a letter is adjacent, so "988" and "116 123" survive
    // as themselves - those are crisis numbers, not obfuscated words.
    const prev = s[i - 1] ?? " ";
    const next = s[i + 1] ?? " ";
    if (/[a-z]/.test(prev) || /[a-z]/.test(next)) positions.push({ index: i, options });
  }

  // 2^6 = 64 forms is plenty; beyond that the message is not obfuscated text.
  if (positions.length === 0 || positions.length > 6) return [s];

  let out = [s];
  for (const { index, options } of positions) {
    out = out.flatMap((variant) =>
      options.map((ch) => variant.slice(0, index) + ch + variant.slice(index + 1)),
    );
  }
  return out;
}

function finish(s: string): string {
  // Apostrophes go FIRST so one pattern covers "dont" and "don't" alike.
  // Expanding before stripping would leave "don't" unexpanded and un-negated,
  // turning "I don't want to die" into an unguarded crisis match.
  let t = s.replace(/'/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, to] of EXPANSIONS) t = t.replace(re, to);
  return t.replace(/\s+/g, " ").trim();
}

export function normalize(input: string): Normalized {
  let s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining marks: "díe" -> "die"
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[–—]/g, " ");

  s = s.replace(/[03457@$+]/g, (ch, i: number) => {
    const prev = s[i - 1] ?? " ";
    const next = s[i + 1] ?? " ";
    return /[a-z]/.test(prev) || /[a-z]/.test(next) ? (LEET_UNAMBIGUOUS[ch] ?? ch) : ch;
  });

  // Stretched words are ambiguous the same way leet is: "diiiiie" is "die" but
  // "killlll" is "kill". Collapsing a run of 3+ to one letter fixes the first
  // and breaks the second, so both readings are kept and rules try each.
  const bases = [...new Set([
    s.replace(/([a-z])\1{2,}/g, "$1$1"),
    s.replace(/([a-z])\1{2,}/g, "$1"),
  ])];

  const forms = [...new Set(bases.flatMap(expandAmbiguous).map(finish))].filter(Boolean);
  const primary = forms[0] ?? "";

  return {
    text: primary,
    forms,
    squeezed: [...new Set(forms.map((f) => f.replace(/[^a-z]/g, "")))],
  };
}

/** True when any readable or squeezed form matches. */
export function matchesAny(n: Normalized, re: RegExp): boolean {
  return n.forms.some((f) => re.test(f)) || n.squeezed.some((f) => re.test(f));
}

/** The first matching excerpt, for `SafetySignal.evidence`. Never the whole message. */
export function firstMatch(n: Normalized, re: RegExp): string | null {
  for (const f of n.forms) {
    const m = re.exec(f);
    if (m) return m[0].slice(0, 120);
  }
  for (const f of n.squeezed) {
    const m = re.exec(f);
    if (m) return m[0].slice(0, 120);
  }
  return null;
}

/** True when a message has enough substance to be worth a model call. */
export function isSubstantive(input: string): boolean {
  return input.replace(/[^a-zA-Z]/g, "").length >= 12;
}
