/**
 * Stored records. Every one of these is a document a teenager owns.
 *
 * Two date rules hold everywhere and are enforced by the validators:
 *   - `localDate` ("YYYY-MM-DD") answers "which day was this for them".
 *   - `createdAt` (ISO instant) answers "in what order did this happen".
 * Deriving one from the other in a component is the bug this split prevents.
 */

import {
  array, boolean, integer, isoInstant, literal, localDate, object, oneOf,
  optional, refine, string, timezone, type Infer, type Validator,
} from "./validate.ts";
import {
  ACHIEVEMENTS, AGE_BANDS, CAUSES, HELP_TOPICS, LESSON_CATEGORIES, MOODS,
  PILLARS, RELATIONS, RISK_LEVELS,
} from "./enums.ts";

/** Bumped when a stored shape changes incompatibly. Written into every record. */
export const SCHEMA_VERSION = "1.0.0";

const id = () => string({ min: 1, max: 128 });

// --- profile ----------------------------------------------------------------

export const PrivacySettingsSchema = object(
  {
    /** Lets the coach read journal entries to spot patterns. Off by default. */
    aiMayReadJournal: boolean(),
    /** Lets the coach keep earlier turns of a conversation. Off by default. */
    aiMayRememberConversations: boolean(),
    /** Allows anonymous, aggregate product analytics. Off by default. */
    shareAnonymousUsage: boolean(),
  },
  "PrivacySettings",
);
export type PrivacySettings = Infer<typeof PrivacySettingsSchema>;

/** Everything off. A teen opts in; they never have to discover an opt-out. */
export const DEFAULT_PRIVACY: PrivacySettings = {
  aiMayReadJournal: false,
  aiMayRememberConversations: false,
  shareAnonymousUsage: false,
};

export const ProfileSchema = object(
  {
    userId: id(),
    displayName: string({ min: 1, max: 40 }),
    /** Drives every streak and "today" calculation. Never inferred server-side. */
    timezone: timezone(),
    ageBand: oneOf(AGE_BANDS),
    /** Free-text daily goal, e.g. "Stay off my phone after 11 PM". */
    goal: optional(string({ max: 140 })),
    /** ISO-3166 alpha-2, chooses which crisis resources are shown. */
    regionCode: optional(string({ min: 2, max: 2 })),
    privacy: PrivacySettingsSchema,
    createdAt: isoInstant(),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "Profile",
);
export type Profile = Infer<typeof ProfileSchema>;

// --- mood check-in ----------------------------------------------------------

export const MoodEntrySchema = refine(
  object(
    {
      id: id(),
      userId: id(),
      localDate: localDate(),
      createdAt: isoInstant(),
      mood: oneOf(MOODS),
      /** Multi-select: a bad day is rarely caused by exactly one thing. */
      causes: array(oneOf(CAUSES), { min: 1, max: 5 }),
      note: optional(string({ max: 500 })),
      schemaVersion: string({ min: 1, max: 16 }),
    },
    "MoodEntry",
  ),
  (v) =>
    v.causes.includes("other") && !v.note?.trim()
      ? 'cause "other" requires a note describing it'
      : v.causes.includes("dont_know") && v.causes.length > 1
        ? '"dont_know" cannot be combined with a specific cause'
        : null,
);
export type MoodEntry = Infer<typeof MoodEntrySchema>;

// --- journal ----------------------------------------------------------------

export const JournalEntrySchema = object(
  {
    id: id(),
    userId: id(),
    localDate: localDate(),
    createdAt: isoInstant(),
    updatedAt: optional(isoInstant()),
    body: string({ min: 1, max: 20_000 }),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "JournalEntry",
);
export type JournalEntry = Infer<typeof JournalEntrySchema>;

// --- content ----------------------------------------------------------------

export const LessonSchema = refine(
  object(
    {
      slug: string({ min: 3, max: 64 }),
      title: string({ min: 3, max: 80 }),
      category: oneOf(LESSON_CATEGORIES),
      /** Honest reading time. Validated against word count in content tests. */
      minutes: integer({ min: 1, max: 3 }),
      hook: string({ min: 10, max: 200 }),
      body: array(string({ min: 10, max: 1200 }), { min: 2, max: 8 }),
      takeaway: string({ min: 10, max: 200 }),
      /** Matches a HelpTopic id so Help Now can offer a relevant lesson. */
      relatedTopics: array(oneOf(HELP_TOPICS), { max: 4 }),
    },
    "Lesson",
  ),
  (v) => (/^[a-z0-9-]+$/.test(v.slug) ? null : `slug "${v.slug}" must be kebab-case`),
);
export type Lesson = Infer<typeof LessonSchema>;

export const ChallengeSchema = refine(
  object(
    {
      id: string({ min: 3, max: 64 }),
      /** Imperative and finishable today. "Put your phone away for 30 minutes." */
      prompt: string({ min: 10, max: 160 }),
      pillar: oneOf(PILLARS),
      minutes: integer({ min: 1, max: 60 }),
      why: string({ min: 10, max: 200 }),
      /** Involves another human. Earns the "Helped Someone" achievement. */
      prosocial: boolean(),
    },
    "Challenge",
  ),
  (v) => (/^[a-z0-9-]+$/.test(v.id) ? null : `id "${v.id}" must be kebab-case`),
);
export type Challenge = Infer<typeof ChallengeSchema>;

/**
 * A short coping exercise shown behind the Help Now button.
 *
 * Interventions exist for the eight ordinary topics only. "I don't feel safe"
 * has no intervention on purpose: it routes to the safety service, and a
 * breathing exercise is the wrong answer to a teen in danger.
 */
export const InterventionSchema = refine(
  object(
    {
      id: string({ min: 3, max: 64 }),
      topic: oneOf(HELP_TOPICS),
      title: string({ min: 3, max: 80 }),
      kind: oneOf(["breathing", "grounding", "reframe", "urge_surf", "action"] as const),
      /** Rendered one line at a time, in order. Short lines: they are read in distress. */
      script: array(string({ min: 1, max: 300 }), { min: 2, max: 12 }),
      /** The steadying sentence at the end, e.g. "one moment, not your whole future". */
      closing: string({ min: 10, max: 300 }),
      /** The "What would help right now?" buttons. */
      nextSteps: array(string({ min: 2, max: 40 }), { min: 2, max: 5 }),
      durationSeconds: integer({ min: 15, max: 900 }),
    },
    "Intervention",
  ),
  (v) =>
    v.topic === "not_safe"
      ? "the not_safe topic must route to the safety service, not an intervention"
      : /^[a-z0-9-]+$/.test(v.id)
        ? null
        : `id "${v.id}" must be kebab-case`,
);
export type Intervention = Infer<typeof InterventionSchema>;

// --- activity ---------------------------------------------------------------

export const ChallengeCompletionSchema = object(
  {
    id: id(),
    userId: id(),
    localDate: localDate(),
    challengeId: string({ min: 3, max: 64 }),
    completedAt: isoInstant(),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "ChallengeCompletion",
);
export type ChallengeCompletion = Infer<typeof ChallengeCompletionSchema>;

export const LessonCompletionSchema = object(
  {
    id: id(),
    userId: id(),
    localDate: localDate(),
    lessonSlug: string({ min: 3, max: 64 }),
    completedAt: isoInstant(),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "LessonCompletion",
);
export type LessonCompletion = Infer<typeof LessonCompletionSchema>;

/**
 * A record that the teen reached for help and what they did next. This is the
 * only trace of a hard moment we keep, and it exists to earn the
 * "Overcame a Difficult Moment" achievement, not to profile anyone.
 */
export const HelpSessionSchema = object(
  {
    id: id(),
    userId: id(),
    localDate: localDate(),
    createdAt: isoInstant(),
    topic: oneOf(HELP_TOPICS),
    /** Which intervention was shown, e.g. "breathing-478". */
    interventionId: string({ min: 1, max: 64 }),
    /** Did they finish it, bounce, or escalate to a person. */
    outcome: oneOf(["completed", "abandoned", "escalated"] as const),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "HelpSession",
);
export type HelpSession = Infer<typeof HelpSessionSchema>;

// --- trusted people ---------------------------------------------------------

export const TrustedPersonSchema = object(
  {
    id: id(),
    userId: id(),
    name: string({ min: 1, max: 60 }),
    relation: oneOf(RELATIONS),
    contactMethod: oneOf(["sms", "email", "in_app"] as const),
    contactValue: string({ min: 3, max: 200 }),
    addedAt: isoInstant(),
    /** Set once the adult confirms. Unverified people can still be messaged. */
    verifiedAt: optional(isoInstant()),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "TrustedPerson",
);
export type TrustedPerson = Infer<typeof TrustedPersonSchema>;

/**
 * A teen-initiated request for a human. Nothing is ever sent to a trusted
 * person without one of these, and it carries only what the teen chose to say
 * (spec section 9: "The app shouldn't automatically expose everything").
 */
export const SupportRequestSchema = object(
  {
    id: id(),
    userId: id(),
    trustedPersonId: id(),
    message: string({ min: 1, max: 500 }),
    urgency: oneOf(["talk_soon", "today", "now"] as const),
    createdAt: isoInstant(),
    sentAt: optional(isoInstant()),
    acknowledgedAt: optional(isoInstant()),
    schemaVersion: string({ min: 1, max: 16 }),
  },
  "SupportRequest",
);
export type SupportRequest = Infer<typeof SupportRequestSchema>;

// --- progress ---------------------------------------------------------------

export const GrowthSchema = object(
  {
    mind: integer({ min: 0, max: 100 }),
    wellbeing: integer({ min: 0, max: 100 }),
    habits: integer({ min: 0, max: 100 }),
    learning: integer({ min: 0, max: 100 }),
  },
  "Growth",
);
export type Growth = Infer<typeof GrowthSchema>;

export const ProgressSnapshotSchema = object(
  {
    userId: id(),
    asOfLocalDate: localDate(),
    growth: GrowthSchema,
    streakDays: integer({ min: 0 }),
    longestStreakDays: integer({ min: 0 }),
    /** True while today is unchecked but yesterday was: the streak is alive. */
    streakAtRisk: boolean(),
    achievements: array(oneOf(ACHIEVEMENTS), { max: ACHIEVEMENTS.length }),
    checkInsTotal: integer({ min: 0 }),
    lessonsTotal: integer({ min: 0 }),
    challengesTotal: integer({ min: 0 }),
  },
  "ProgressSnapshot",
);
export type ProgressSnapshot = Infer<typeof ProgressSnapshotSchema>;

// --- safety -----------------------------------------------------------------

export const SafetySignalSchema = object(
  {
    /** Stable id of the rule or model check that fired, e.g. "self-harm-intent". */
    ruleId: string({ min: 1, max: 64 }),
    level: oneOf(RISK_LEVELS),
    /** The matched phrase, kept short. Never the whole message. */
    evidence: string({ max: 200 }),
  },
  "SafetySignal",
);
export type SafetySignal = Infer<typeof SafetySignalSchema>;

export const SafetyVerdictSchema = object(
  {
    level: oneOf(RISK_LEVELS),
    /** Which tiers contributed. "deterministic" alone means no model was called. */
    tiers: array(oneOf(["deterministic", "model"] as const), { min: 1, max: 2 }),
    signals: array(SafetySignalSchema, { max: 20 }),
    /** True => the reply must route to a human, whatever else it says. */
    requiresHumanHandoff: boolean(),
    /** True => stop the ordinary coach flow and show the crisis card. */
    blocksNormalFlow: boolean(),
  },
  "SafetyVerdict",
);
export type SafetyVerdict = Infer<typeof SafetyVerdictSchema>;

// --- coach ------------------------------------------------------------------

export const CoachTurnSchema = object(
  {
    role: oneOf(["teen", "coach"] as const),
    content: string({ min: 1, max: 4000 }),
    at: isoInstant(),
  },
  "CoachTurn",
);
export type CoachTurn = Infer<typeof CoachTurnSchema>;

export const CoachRequestSchema = object(
  {
    userId: id(),
    message: string({ min: 1, max: 4000 }),
    /** Trimmed by the coach service before it reaches a model. */
    history: array(CoachTurnSchema, { max: 40 }),
    /** Set when the conversation started from a Help Now topic. */
    topic: optional(oneOf(HELP_TOPICS)),
    ageBand: oneOf(AGE_BANDS),
    regionCode: optional(string({ min: 2, max: 2 })),
    /** Names the teen can be pointed at. Empty means "help them add one". */
    trustedPeople: array(
      object({ id: id(), name: string({ min: 1, max: 60 }), relation: oneOf(RELATIONS) }),
      { max: 5 },
    ),
    /** Recent moods, so the coach can notice a pattern without reading the journal. */
    recentMoods: array(oneOf(MOODS), { max: 14 }),
  },
  "CoachRequest",
);
export type CoachRequest = Infer<typeof CoachRequestSchema>;

export const EscalationSchema = object(
  {
    reason: oneOf(["self_harm", "abuse", "immediate_danger", "beyond_scope"] as const),
    /** Rendered verbatim. Never model-generated when the level is crisis. */
    message: string({ min: 10, max: 1200 }),
    resources: array(
      object(
        {
          name: string({ min: 1, max: 80 }),
          contact: string({ min: 1, max: 80 }),
          regionCode: string({ min: 2, max: 2 }),
          note: optional(string({ max: 160 })),
        },
        "CrisisResource",
      ),
      { max: 6 },
    ),
    /** Offers the one-tap "I want someone to know I'm struggling" flow. */
    offerTrustedPersonHandoff: boolean(),
  },
  "Escalation",
);
export type Escalation = Infer<typeof EscalationSchema>;

export const CoachReplySchema = refine(
  object(
    {
      message: string({ min: 1, max: 2000 }),
      /** The "What would help right now?" buttons. Always actionable. */
      suggestions: array(string({ min: 2, max: 60 }), { max: 4 }),
      riskLevel: oneOf(RISK_LEVELS),
      escalation: optional(EscalationSchema),
      /** Which provider answered, or "template" when no model was involved. */
      source: oneOf(["template", "model"] as const),
    },
    "CoachReply",
  ),
  (v) =>
    (v.riskLevel === "crisis" || v.riskLevel === "elevated") && !v.escalation
      ? `riskLevel "${v.riskLevel}" requires an escalation`
      : v.riskLevel === "crisis" && v.source !== "template"
        ? "a crisis reply must come from a reviewed template, not a model"
        : null,
);
export type CoachReply = Infer<typeof CoachReplySchema>;

// --- llm --------------------------------------------------------------------

export const LlmRequestSchema = object(
  {
    system: string({ min: 1, max: 20_000 }),
    prompt: string({ min: 1, max: 40_000 }),
    /** Ask the provider for JSON. Providers that cannot must still be parsed. */
    expectJson: boolean(),
    maxTokens: optional(integer({ min: 1, max: 8192 })),
    timeoutMs: optional(integer({ min: 1000, max: 300_000 })),
  },
  "LlmRequest",
);
export type LlmRequest = Infer<typeof LlmRequestSchema>;

export const LlmResponseSchema = object(
  {
    text: string({ max: 100_000 }),
    provider: string({ min: 1, max: 40 }),
    model: optional(string({ max: 80 })),
    durationMs: integer({ min: 0 }),
    /** Present when the provider reports usage. Never invented. */
    inputTokens: optional(integer({ min: 0 })),
    outputTokens: optional(integer({ min: 0 })),
  },
  "LlmResponse",
);
export type LlmResponse = Infer<typeof LlmResponseSchema>;

export const SCHEMAS: Record<string, Validator<unknown>> = {
  Profile: ProfileSchema,
  MoodEntry: MoodEntrySchema,
  JournalEntry: JournalEntrySchema,
  Lesson: LessonSchema,
  Challenge: ChallengeSchema,
  ChallengeCompletion: ChallengeCompletionSchema,
  LessonCompletion: LessonCompletionSchema,
  HelpSession: HelpSessionSchema,
  Intervention: InterventionSchema,
  TrustedPerson: TrustedPersonSchema,
  SupportRequest: SupportRequestSchema,
  ProgressSnapshot: ProgressSnapshotSchema,
  SafetyVerdict: SafetyVerdictSchema,
  CoachRequest: CoachRequestSchema,
  CoachReply: CoachReplySchema,
  LlmRequest: LlmRequestSchema,
  LlmResponse: LlmResponseSchema,
} as unknown as Record<string, Validator<unknown>>;

export { literal };
