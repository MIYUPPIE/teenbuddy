/**
 * The closed vocabularies of the product. Every list here is a UI surface as
 * well as a storage value, so the label lives beside the id: one source of
 * truth means a renamed emoji can never desync from a stored record.
 */

export const MOODS = [
  "great",
  "good",
  "okay",
  "sad",
  "angry",
  "anxious",
  "tired",
  "lonely",
] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, { emoji: string; label: string; tone: number }> = {
  great: { emoji: "😊", label: "Great", tone: 5 },
  good: { emoji: "🙂", label: "Good", tone: 4 },
  okay: { emoji: "😐", label: "Okay", tone: 3 },
  sad: { emoji: "😔", label: "Sad", tone: 2 },
  angry: { emoji: "😡", label: "Angry", tone: 2 },
  anxious: { emoji: "😰", label: "Anxious", tone: 2 },
  tired: { emoji: "😴", label: "Tired", tone: 3 },
  lonely: { emoji: "😞", label: "Lonely", tone: 1 },
};

/** 1..5, where 5 is the best day. Used for trend maths, never shown as a score. */
export const moodTone = (mood: Mood): number => MOOD_LABELS[mood].tone;

export const CAUSES = [
  "school",
  "family",
  "friends",
  "relationship",
  "social_media",
  "money",
  "exams",
  "bullying",
  "loneliness",
  "dont_know",
  "other",
] as const;
export type Cause = (typeof CAUSES)[number];

export const CAUSE_LABELS: Record<Cause, string> = {
  school: "School",
  family: "Family",
  friends: "Friends",
  relationship: "Relationship",
  social_media: "Social media",
  money: "Money",
  exams: "Exams",
  bullying: "Bullying",
  loneliness: "Feeling lonely",
  dont_know: "Don't know",
  other: "Something else",
};

/** The "What are you dealing with?" menu behind the Help Now button. */
export const HELP_TOPICS = [
  "anxiety_stress",
  "anger",
  "sadness",
  "loneliness",
  "cant_stop_scrolling",
  "sexual_temptation",
  "want_to_cry",
  "negative_thoughts",
  "not_safe",
] as const;
export type HelpTopic = (typeof HELP_TOPICS)[number];

export const HELP_TOPIC_LABELS: Record<HelpTopic, { emoji: string; label: string }> = {
  anxiety_stress: { emoji: "😰", label: "Anxiety / stress" },
  anger: { emoji: "😡", label: "Anger" },
  sadness: { emoji: "😔", label: "Sadness" },
  loneliness: { emoji: "🧍", label: "Loneliness" },
  cant_stop_scrolling: { emoji: "📱", label: "Can't stop scrolling" },
  sexual_temptation: { emoji: "🔞", label: "Sexual temptation" },
  want_to_cry: { emoji: "😭", label: "I want to cry" },
  negative_thoughts: { emoji: "💭", label: "Negative thoughts" },
  not_safe: { emoji: "🆘", label: "I don't feel safe" },
};

/**
 * "I don't feel safe" is a declared emergency, not a mood. It bypasses the
 * ordinary intervention flow entirely; services branch on this, never on a
 * hardcoded string.
 */
export const isEmergencyTopic = (topic: HelpTopic): boolean => topic === "not_safe";

export const LESSON_CATEGORIES = [
  "mind",
  "digital_life",
  "relationships",
  "school",
  "personal_growth",
] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export const LESSON_CATEGORY_LABELS: Record<LessonCategory, { emoji: string; label: string }> = {
  mind: { emoji: "🧠", label: "Mind" },
  digital_life: { emoji: "📱", label: "Digital life" },
  relationships: { emoji: "👥", label: "Relationships" },
  school: { emoji: "🎓", label: "School" },
  personal_growth: { emoji: "❤️", label: "Personal growth" },
};

/** The four bars on the Home screen. Deliberately not a single "score". */
export const PILLARS = ["mind", "wellbeing", "habits", "learning"] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABELS: Record<Pillar, { emoji: string; label: string }> = {
  mind: { emoji: "🧠", label: "Mind" },
  wellbeing: { emoji: "❤️", label: "Wellbeing" },
  habits: { emoji: "🎯", label: "Habits" },
  learning: { emoji: "📚", label: "Learning" },
};

export const ACHIEVEMENTS = [
  "first_checkin",
  "seven_days_consistent",
  "ten_lessons",
  "overcame_difficult_moment",
  "helped_someone",
  "five_challenges",
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];

export const ACHIEVEMENT_LABELS: Record<AchievementId, { emoji: string; label: string }> = {
  first_checkin: { emoji: "🏆", label: "First Check-in" },
  seven_days_consistent: { emoji: "🔥", label: "7 Days Consistent" },
  ten_lessons: { emoji: "🧠", label: "Completed 10 Lessons" },
  overcame_difficult_moment: { emoji: "💪", label: "Overcame a Difficult Moment" },
  helped_someone: { emoji: "❤️", label: "Helped Someone" },
  five_challenges: { emoji: "🎯", label: "Completed 5 Challenges" },
};

export const RELATIONS = [
  "parent",
  "guardian",
  "teacher",
  "counselor",
  "relative",
  "mentor",
] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_LABELS: Record<Relation, string> = {
  parent: "Parent",
  guardian: "Guardian",
  teacher: "Teacher",
  counselor: "Counselor",
  relative: "Relative",
  mentor: "Mentor",
};

/**
 * Ordered least to most severe. `none` and `concern` continue a normal
 * conversation; `elevated` and `crisis` change what the app is allowed to do.
 */
export const RISK_LEVELS = ["none", "concern", "elevated", "crisis"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const riskRank = (level: RiskLevel): number => RISK_LEVELS.indexOf(level);

/** Risk only ever moves up when two checks disagree. Never averaged. */
export const maxRisk = (...levels: RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>((a, b) => (riskRank(b) > riskRank(a) ? b : a), "none");

export const AGE_BANDS = ["13-15", "16-17", "18+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
