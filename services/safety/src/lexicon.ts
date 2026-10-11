/**
 * The deterministic risk lexicon.
 *
 * This is the tier that always runs: free, instant, offline, and identical on
 * every call. It exists so that "I want to kill myself" can never reach a
 * language model, a network timeout, or a rate limit before it reaches a crisis
 * response. The model tier can only ever *raise* the level this produces.
 *
 * Three groups, applied in order:
 *   1. IDIOMS   - spans that look alarming and are not. Removed before matching.
 *   2. RULES    - the phrases that carry real signal.
 *   3. GUARDS   - negation and past-tense, which downgrade but never silence.
 *
 * On the precision/recall trade: a missed crisis is unbounded harm and a false
 * alarm is a teenager being handed a helpline they did not need. These are not
 * symmetric, so the lexicon leans toward recall everywhere except idioms, where
 * the evidence that nothing is wrong is unambiguous.
 */

import type { RiskLevel } from "@teenbuddy/contracts";

/**
 * Figures of speech that contain crisis vocabulary. Matched spans are blanked
 * before any rule runs, so "my feet are killing me" cannot reach a rule at all.
 *
 * Every entry here is a phrase whose non-literal reading is overwhelmingly the
 * common one. Anything genuinely ambiguous belongs in RULES, not here.
 */
export const IDIOMS: readonly RegExp[] = [
  /\b(?:my|the|these|those|his|her|their)\s+\w+(?:\s+\w+)?\s+(?:are|is)\s+killing\s+me\b/g,
  /\bkill(?:ing|ed)?\s+(?:it|time|the\s+\w+|this\s+\w+)\b/g,
  /\b(?:you|he|she|they|we)\s+killed\s+it\b/g,
  /\bkiller\b/g,
  /\bdy(?:ing|e)\s+(?:to|for)\s+\w+/g,
  /\bdying\s+of\s+(?:laughter|boredom|embarrassment|cringe|thirst|hunger)\b/g,
  /\b(?:dead|bored)\s+(?:tired|serious|inside\s+joke)\b/g,
  /\bbored\s+to\s+death\b/g,
  /\bdrop\s+dead\s+gorgeous\b/g,
  /\bdead\s+(?:easy|simple|certain|on|weight|end|line)\b/g,
  /\bdeadline\b/g,
  /\bto\s+die\s+for\b/g,
  /\bi\s+could\s+(?:kill|murder)\s+(?:for\s+)?a\s+\w+/g,
  /\bsuicide\s+squad\b/g,
  /\bcareer\s+suicide\b/g,
  /\bsocial\s+suicide\b/g,
  /\bcut\s+(?:it|me)\s+out\b/g,
  /\bcut\s+(?:my|the)\s+hair\b/g,
  /\b(?:accidentally|nearly|almost)\s+cut\s+my\s*self\b/g,
  /\bcut\s+my\s*self\s+(?:shaving|cooking|by\s+accident|accidentally|on\s+(?:the|a|some)\s+\w+)\b/g,
  /\bhang\s+out\b/g,
  /\bhang\s+on\b/g,
  /\bkill\s+myself\s+laughing\b/g,
  /\bdied\s+laughing\b/g,
  /\bi\s+am\s+dead\b/g,
  /\bthis\s+is\s+killing\s+me\s+lol\b/g,
];

export type Rule = {
  id: string;
  level: RiskLevel;
  /** Run against every normalised form and every squeezed form. */
  patterns: readonly RegExp[];
  /** Whether negation and past tense may downgrade a hit. */
  guardable: boolean;
  /** Human-readable reason, used in the eval report and never shown to a teen. */
  describes: string;
};

/**
 * `S` allows optional whitespace, so one pattern covers "kill myself" in the
 * readable form and "killmyself" in the squeezed form.
 */
const S = "\\s*";

export const RULES: readonly Rule[] = [
  {
    id: "self-harm-intent",
    level: "crisis",
    describes: "stated intent to end their own life",
    guardable: true,
    patterns: [
      new RegExp(`\\bkill${S}(?:my${S}self|me)\\b`),
      new RegExp(`\\bend${S}(?:my${S}(?:life|existence)|it${S}all|things)\\b`),
      new RegExp(`\\btak(?:e|es|ing|en)${S}my${S}own${S}life\\b`),
      new RegExp(`\\b(?:want(?:s|ed|ing)?|going|plan(?:s|ned|ning)?|ready|about)${S}to${S}die\\b`),
      new RegExp(`\\bwish${S}i${S}(?:was|were)${S}dead\\b`),
      new RegExp(`\\bbetter${S}off${S}(?:dead|without${S}me)\\b`),
      new RegExp(`\\bdo${S}not${S}want${S}to${S}(?:be${S}(?:here|alive)|live|exist|wake${S}up)\\b`),
      new RegExp(`\\bcommit${S}suicide\\b`),
      new RegExp(`\\bsuicidal\\b`),
      new RegExp(`\\bnot${S}be${S}alive\\b`),
      new RegExp(`\\bwant${S}(?:it|everything)${S}to${S}(?:end|stop)${S}forever\\b`),
    ],
  },
  {
    id: "self-harm-method",
    level: "crisis",
    describes: "naming a method or a plan",
    guardable: true,
    patterns: [
      new RegExp(`\\b(?:hang|shoot|drown)${S}my${S}self\\b`),
      new RegExp(`\\boverdose\\b`),
      new RegExp(`\\btake${S}(?:all${S})?(?:the${S})?pills\\b`),
      new RegExp(`\\bjump${S}(?:off|in${S}front)\\b`),
      new RegExp(`\\bslit${S}my${S}(?:wrists|throat)\\b`),
      new RegExp(`\\bcut${S}my${S}wrists\\b`),
      new RegExp(`\\bwrote${S}a${S}(?:note|letter)${S}to${S}(?:my|everyone)\\b`),
      new RegExp(`\\bsaying${S}good${S}bye${S}(?:to${S}everyone|forever)\\b`),
    ],
  },
  {
    id: "self-harm-ongoing",
    level: "crisis",
    describes: "current or recent self-injury",
    guardable: true,
    patterns: [
      new RegExp(`\\b(?:cutting|burning|starving|hurting|harming)${S}my${S}self\\b`),
      // Bare "cut myself" catches "i cut myself", "used to cut myself" and
      // "cut myself again last night". Accidents are handled as idioms below.
      new RegExp(`\\bcut${S}my${S}self\\b`),
      new RegExp(`\\bself${S}harm(?:ing|ed)?\\b`),
      new RegExp(`\\bmade${S}my${S}self${S}(?:bleed|sick)\\b`),
    ],
  },
  {
    id: "immediate-danger",
    level: "crisis",
    describes: "in danger right now",
    guardable: false,
    patterns: [
      new RegExp(`\\bi${S}am${S}not${S}safe\\b`),
      new RegExp(`\\bdo${S}not${S}feel${S}safe\\b`),
      new RegExp(`\\b(?:someone|he|she|they)${S}(?:is|are)${S}going${S}to${S}(?:hurt|kill)${S}me\\b`),
      new RegExp(`\\bscared${S}(?:to${S}go|of${S}going)${S}home\\b`),
      new RegExp(`\\bafraid${S}(?:to${S}go|of${S}going)${S}home\\b`),
      new RegExp(`\\bin${S}danger\\b`),
      new RegExp(`\\bthreatening${S}to${S}(?:kill|hurt)${S}me\\b`),
    ],
  },
  {
    id: "abuse-disclosure",
    level: "crisis",
    describes: "disclosing abuse",
    guardable: false,
    patterns: [
      new RegExp(`\\b(?:being|been|getting)${S}abused\\b`),
      new RegExp(`\\b(?:he|she|they|dad|mum|mom|my${S}\\w+)${S}(?:hits|beats|hurts)${S}me\\b`),
      new RegExp(`\\btouched${S}me\\b`),
      new RegExp(`\\bmade${S}me${S}do${S}(?:things|stuff)\\b`),
      new RegExp(`\\bforced${S}me${S}to\\b`),
      new RegExp(`\\bhits${S}me${S}when\\b`),
    ],
  },
  {
    id: "hopelessness",
    level: "elevated",
    describes: "hopelessness or self-loathing without stated intent",
    guardable: true,
    patterns: [
      new RegExp(`\\bno${S}(?:point|reason)${S}(?:in${S})?(?:any${S}more|anything|living|trying)\\b`),
      new RegExp(`\\bnothing${S}matters${S}any${S}more\\b`),
      new RegExp(`\\bi${S}hate${S}my${S}self\\b`),
      new RegExp(`\\bi${S}am${S}(?:worthless|a${S}burden|pathetic|disgusting)\\b`),
      new RegExp(`\\beveryone${S}would${S}be${S}(?:better|happier)${S}without${S}me\\b`),
      new RegExp(`\\bnobody${S}(?:would${S})?(?:care|notice|miss${S}me)\\b`),
      new RegExp(`\\bcan${S}not${S}(?:go${S}on|do${S}this${S}any${S}more|keep${S}going)\\b`),
      new RegExp(`\\bgiving${S}up${S}(?:on${S}everything|entirely)\\b`),
      new RegExp(`\\bwhat${S}is${S}the${S}point${S}of${S}(?:anything|living|me)\\b`),
      new RegExp(`\\btrapped${S}(?:with${S}no${S}way${S}out|forever)\\b`),
    ],
  },
  {
    id: "third-party-risk",
    level: "elevated",
    describes: "someone else is at risk",
    guardable: false,
    patterns: [
      new RegExp(`\\b(?:my${S}(?:friend|mate|sister|brother)|someone${S}i${S}know)${S}\\w*${S}(?:wants${S}to${S}die|is${S}suicidal|is${S}cutting|wants${S}to${S}kill)\\b`),
      new RegExp(`\\bworried${S}(?:that${S})?(?:my${S}friend|she|he|they)${S}(?:might|will)${S}(?:hurt|kill)\\b`),
      // Bare pronoun subjects. These must exist: the third-party subject guard
      // suppresses the first-person rules on exactly this text, so without a
      // receiving pattern the disclosure would score `none`. A test asserts the
      // invariant that suppression never lands below `elevated`.
      new RegExp(`\\b(?:he|she|they)${S}(?:want(?:s|ed)?|is${S}going|are${S}going|plans?)${S}to${S}(?:die|kill${S}(?:him|her|them)${S}sel(?:f|ves))\\b`),
      new RegExp(`\\b(?:he|she|they)${S}(?:is|are)${S}(?:suicidal|self${S}harming)\\b`),
      new RegExp(`\\b(?:he|she|they)${S}(?:is|are)${S}(?:cutting|hurting|harming)${S}(?:him|her|them)${S}sel(?:f|ves)\\b`),
      new RegExp(`\\b(?:he|she|they)${S}(?:said|told${S}me)${S}(?:he|she|they)${S}want(?:s|ed)?${S}to${S}die\\b`),
    ],
  },
  {
    id: "harm-instruction",
    level: "crisis",
    describes: "text telling someone to harm themselves",
    guardable: false,
    patterns: [
      new RegExp(`\\bkill${S}your${S}self\\b`),
      new RegExp(`\\bend${S}your${S}(?:life|existence)\\b`),
      new RegExp(`\\byou${S}should${S}(?:die|just${S}die)\\b`),
      new RegExp(`\\bhurt${S}your${S}self\\b`),
      new RegExp(`\\bno${S}one${S}would${S}miss${S}you\\b`),
    ],
  },
  {
    id: "acute-distress",
    level: "concern",
    describes: "acute distress, no risk language",
    guardable: true,
    patterns: [
      new RegExp(`\\bpanic${S}attack\\b`),
      new RegExp(`\\bcan${S}not${S}(?:stop${S}crying|breathe|cope|handle${S}this)\\b`),
      new RegExp(`\\bfalling${S}apart\\b`),
      new RegExp(`\\bbreaking${S}down\\b`),
      new RegExp(`\\bover${S}whelmed\\b`),
      new RegExp(`\\boverwhelmed\\b`),
      new RegExp(`\\bi${S}am${S}(?:so${S})?(?:scared|terrified)\\b`),
      new RegExp(`\\bhave${S}not${S}(?:eaten|slept)${S}(?:in|for)${S}days\\b`),
    ],
  },
];

/**
 * Negation and past tense. These downgrade a hit by one level, never to `none`.
 *
 * "I don't want to kill myself" is usually ambivalence rather than safety, and
 * "I used to cut myself" is a disclosure that still deserves a human. Silencing
 * either would be the wrong trade, so a guarded crisis becomes `elevated`:
 * still escalated, still offered a person, without the full emergency card.
 */
export const GUARDS: readonly { id: string; pattern: RegExp }[] = [
  { id: "negated", pattern: /\b(?:do not|does not|did not|never|no longer|would not|will not|am not|is not|was not|are not)\b/ },
  { id: "past-tense", pattern: /\b(?:used to|last (?:year|month)|when i was|back then|years ago|in the past)\b/ },
  // Fiction and coursework framing. The optional \w+ allows "for my english
  // essay", not just "for my essay". Downgrading only ever reaches `elevated`,
  // so a real disclosure dressed as a story still escalates and still offers a
  // person - the guard buys precision without ever buying silence.
  { id: "hypothetical", pattern: /\b(?:if i (?:ever|did)|what if|imagine if|hypothetically|in (?:a|the) (?:book|film|movie|game|story|play|script)|writing (?:a|an|my) (?:story|book|essay|poem|script)|for (?:my|a|an)(?: \w+)? (?:essay|assignment|homework|project|story|coursework|class)|(?:a|the|my) character\b)/ },
];

/**
 * A third-party subject immediately before a self-harm match.
 *
 * "my friend wants to die" is a real disclosure, but it is *someone else's*
 * risk. Scoring it as the teen's own crisis renders "Are you safe right now?"
 * to a worried friend, which is both wrong and alienating. The `third-party-risk`
 * rule still fires at `elevated`, so the disclosure is never lost - only
 * re-attributed.
 *
 * The `(?!i\b)` lookahead is what keeps "I told my friend I want to die" a
 * first-person crisis: a first-person pronoun between the subject and the match
 * breaks the guard.
 */
export const THIRD_PARTY_SUBJECT =
  /\b(?:my (?:friend|mate|sister|brother|cousin|classmate|girlfriend|boyfriend)|someone (?:i know|else)|a friend|he|she|they)\b(?:\s+(?!i\b)\w+){0,2}\s*$/;

/** Rules whose attribution the third-party subject guard applies to. */
export const FIRST_PERSON_RULES: readonly string[] = [
  "self-harm-intent",
  "self-harm-method",
  "self-harm-ongoing",
  "hopelessness",
];

/** How far before a match to look for a guard, in characters. */
export const GUARD_WINDOW = 60;
