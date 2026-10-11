/**
 * The colour system.
 *
 * Every mood, pillar and lesson category carries its own hue, so the app reads
 * as a place with personality rather than a form. Colour is *information* here:
 * a teen learns that violet means Mind and amber means Habits long before they
 * read either label.
 *
 * Only the hue angle is stored. Lightness and chroma come from the theme, which
 * is what lets one number work in light mode, dark mode, as a solid fill, as a
 * soft background and as text, without maintaining five palettes that drift.
 *
 * The maps are `Record<Enum, number>`, so adding a mood to `@teenbuddy/contracts`
 * fails to compile until it has a colour. A test asserts the same at runtime.
 */

import type { CSSProperties } from "react";
import type { Cause, HelpTopic, LessonCategory, Mood, Pillar } from "@teenbuddy/contracts";

/** OKLCH hue angles, 0-360. */
export const MOOD_HUE: Record<Mood, number> = {
  great: 75,    // warm gold
  good: 145,    // fresh green
  okay: 230,    // level blue-grey
  sad: 255,     // deep blue
  angry: 25,    // hot orange-red
  anxious: 305, // restless magenta
  tired: 280,   // dim indigo
  lonely: 195,  // cool teal
};

/**
 * Causes are tinted so the chip row reads as a spectrum rather than a grey
 * wall of options. Related causes sit near each other on the wheel: the three
 * people-shaped ones (family, friends, relationship) are neighbours, and the
 * two school-shaped ones share a hue.
 */
export const CAUSE_HUE: Record<Cause, number> = {
  school: 65,
  family: 15,
  friends: 340,
  relationship: 355,
  social_media: 200,
  money: 145,
  exams: 65,
  bullying: 30,
  loneliness: 195,
  dont_know: 265,
  other: 285,
};

export const PILLAR_HUE: Record<Pillar, number> = {
  mind: 285,
  wellbeing: 350,
  habits: 65,
  learning: 200,
};

export const CATEGORY_HUE: Record<LessonCategory, number> = {
  mind: 285,
  digital_life: 200,
  relationships: 350,
  school: 65,
  personal_growth: 145,
};

/**
 * Help topics are tinted by the feeling, not by severity.
 *
 * `not_safe` is deliberately absent: the emergency path is rendered in the
 * reserved urgent colour and must never pick up a cheerful tint. `topicHue`
 * returns null for it, and the UI branches on that.
 */
const TOPIC_HUE: Partial<Record<HelpTopic, number>> = {
  anxiety_stress: 305,
  anger: 25,
  sadness: 255,
  loneliness: 195,
  cant_stop_scrolling: 200,
  sexual_temptation: 330,
  want_to_cry: 245,
  negative_thoughts: 285,
};

export const topicHue = (topic: HelpTopic): number | null => TOPIC_HUE[topic] ?? null;

/**
 * Spreads onto any element to set its tint.
 *
 * Cast because React's `CSSProperties` has no index signature for custom
 * properties, even though the DOM accepts them and React forwards them.
 */
export const hue = (value: number): CSSProperties =>
  ({ "--h": String(value) }) as CSSProperties;
