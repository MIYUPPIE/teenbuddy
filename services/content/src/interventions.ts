/**
 * Help Now interventions.
 *
 * These are read by someone who is not at their best, so every line is short,
 * nothing is a paragraph, and no script asks a question it doesn't handle an
 * answer to. Each one is 30 seconds to 3 minutes: long enough for the physical
 * peak of a feeling to pass, short enough to start while feeling awful.
 *
 * Design rules the tests hold:
 *   - Exactly one intervention per ordinary topic.
 *   - **No intervention for `not_safe`.** That topic routes to
 *     `@teenbuddy/safety`. Offering breathing exercises to a teen who has just
 *     said they are in danger is the single worst thing this screen could do.
 *   - Every one offers a route to a human in `nextSteps`. Self-help is never
 *     presented as the only option.
 */

import { HELP_TOPICS, type HelpTopic, type Intervention } from "@teenbuddy/contracts";

/** Present on every intervention, so a person is always one tap away. */
const TALK_TO_SOMEONE = "Talk to someone";
const KEEP_TALKING = "Keep talking here";

export const INTERVENTIONS: readonly Intervention[] = [
  {
    id: "breathing-446",
    topic: "anxiety_stress",
    title: "Let's slow things down",
    kind: "breathing",
    script: [
      "Put both feet flat on the floor.",
      "Breathe in through your nose — 4 seconds.",
      "Hold — 4 seconds.",
      "Breathe out slowly through your mouth — 6 seconds.",
      "Again. In 4. Hold 4. Out 6.",
      "One more time. Make the out-breath the longest part.",
      "That long out-breath is doing the work. It's the part that tells your body the emergency is over.",
    ],
    closing: "You're dealing with one moment, not your entire future.",
    nextSteps: ["Take a walk", "Listen to music", TALK_TO_SOMEONE, "Write it down", KEEP_TALKING],
    durationSeconds: 90,
  },
  {
    id: "anger-cool-down",
    topic: "anger",
    title: "Before you do anything",
    kind: "urge_surf",
    script: [
      "Don't send it. Don't say it yet. It'll still be there in ten minutes.",
      "Anger peaks fast and drops fast. You're near the top right now.",
      "Move: stand up, walk out of the room, run cold water over your wrists.",
      "Now unclench your jaw and drop your shoulders. Both were up.",
      "Say what actually happened, in one plain sentence, in your head.",
      "Then the harder one: what did it make you feel underneath the anger? Disrespected? Ignored? Scared?",
      "That second one is usually the real thing, and it's the one worth saying out loud later.",
    ],
    closing: "Being angry is fine. It's information. You just don't have to act at the peak of it.",
    nextSteps: ["Wait 10 minutes", "Go outside", "Write it down", TALK_TO_SOMEONE, KEEP_TALKING],
    durationSeconds: 120,
  },
  {
    id: "sadness-stay-with-it",
    topic: "sadness",
    title: "You don't have to fix this right now",
    kind: "grounding",
    script: [
      "This doesn't need solving in the next five minutes.",
      "Look around and find five things you can see. Actually find them.",
      "Four things you can touch. Feel each one.",
      "Three things you can hear.",
      "Sadness isn't an emergency and it isn't a flaw. It's usually about something that mattered.",
      "Two questions, honestly: have you eaten today, and did you sleep?",
      "Neither fixes it. Both make it heavier when the answer is no.",
    ],
    closing: "Heavy days pass, even when nothing about them changes. You don't have to earn feeling better.",
    nextSteps: ["Eat something", "Go outside", TALK_TO_SOMEONE, "Write it down", KEEP_TALKING],
    durationSeconds: 120,
  },
  {
    id: "loneliness-one-message",
    topic: "loneliness",
    title: "One small contact",
    kind: "action",
    script: [
      "Loneliness lies about one specific thing: it says everyone else is fine and you're the exception.",
      "They're not. Plenty of people you know feel exactly this, tonight.",
      "It also makes reaching out feel humiliating. That feeling is the loneliness talking, not a fact about how people see you.",
      "So make it tiny. Think of one person. Not your closest, just anyone.",
      "Send something with no weight on it. A meme. \"How was your day?\" Nothing that needs a big reply.",
      "You're not asking for help. You're just making contact.",
    ],
    closing: "Connection rebuilds in small, boring pieces. One message is a real one.",
    nextSteps: ["Message someone", "Go where people are", TALK_TO_SOMEONE, KEEP_TALKING],
    durationSeconds: 90,
  },
  {
    id: "scroll-break-loop",
    topic: "cant_stop_scrolling",
    title: "Break the loop",
    kind: "urge_surf",
    script: [
      "Quick check: are you still reading, or just flicking?",
      "If it's flicking, the information stopped a while ago. This is the loop now.",
      "Stand up. Right now, before the next post.",
      "Put the phone somewhere that isn't in reach. Another room is better than a pocket.",
      "Ten minutes. Set a timer. You can pick it up afterwards if you still want to.",
      "In those ten minutes: water, window, or one small thing that has an ending.",
      "You're not quitting anything. You're just arriving after the peak.",
    ],
    closing: "It's built by professionals to be hard to put down. Getting stuck isn't a character flaw.",
    nextSteps: ["Set a 10-min timer", "Go to another room", "Do one small thing", KEEP_TALKING],
    durationSeconds: 60,
  },
  {
    id: "urge-ride-it-out",
    topic: "sexual_temptation",
    title: "Ride it out",
    kind: "urge_surf",
    script: [
      "Nothing's wrong with you for feeling this. It's normal and it isn't the problem.",
      "The urge is a wave. It rises, peaks, and drops. It always drops.",
      "Right now it feels permanent. That's what the top of the wave feels like.",
      "Change the room. Change the light. Put the device down and stand somewhere different.",
      "Now the useful question: what happened just before this? Bored? Stressed? Alone late at night?",
      "That's usually the trigger, not desire. Naming it takes most of the power out.",
      "Give it ten minutes without deciding anything.",
    ],
    closing: "You don't have to win a fight. You just have to be somewhere else for ten minutes.",
    nextSteps: ["Set a 10-min timer", "Go to another room", "Move your body", KEEP_TALKING],
    durationSeconds: 90,
  },
  {
    id: "let-yourself-cry",
    topic: "want_to_cry",
    title: "Then cry",
    kind: "grounding",
    script: [
      "Then cry. It's allowed, and holding it in is its own kind of exhausting.",
      "If you need somewhere private: bathroom, bedroom, outside, a walk.",
      "Crying is your body finishing something, not falling apart.",
      "You don't need a good enough reason. Sometimes it's just accumulated.",
      "When it eases, breathe out slowly a few times. Longer out than in.",
      "Then water, and something to eat if you haven't.",
    ],
    closing: "People feel wrung out and clearer afterwards. That's normal. Nothing is broken.",
    nextSteps: ["Find somewhere private", "Get some water", TALK_TO_SOMEONE, KEEP_TALKING],
    durationSeconds: 120,
  },
  {
    id: "thought-not-fact",
    topic: "negative_thoughts",
    title: "A thought isn't a verdict",
    kind: "reframe",
    script: [
      "Catch the loudest one and put it into words. One sentence.",
      "Now say it again with four words in front: \"I'm having the thought that…\"",
      "Hear the difference? Same sentence, and now it's a thought rather than a fact about you.",
      "Three questions. Would you say it to a friend in your exact position?",
      "Is it about all of you, forever? Words like always, never and everyone are the tell.",
      "What would you actually tell that friend?",
      "You don't have to believe the kinder version. You just have to notice there is one.",
    ],
    closing: "Your brain generates thousands of these a day and most are noise. This one is allowed to be noise too.",
    nextSteps: ["Write it down", "Do one small thing", TALK_TO_SOMEONE, KEEP_TALKING],
    durationSeconds: 120,
  },
];

export const INTERVENTION_BY_TOPIC: ReadonlyMap<HelpTopic, Intervention> = new Map(
  INTERVENTIONS.map((i) => [i.topic, i]),
);

/**
 * The intervention for a topic, or `null` when the topic must not get one.
 *
 * `not_safe` returns null by design. The caller is expected to route to
 * `@teenbuddy/safety` instead; a null here is an instruction, not a gap.
 */
export const interventionFor = (topic: HelpTopic): Intervention | null =>
  INTERVENTION_BY_TOPIC.get(topic) ?? null;

/** Topics that are handled here rather than by the safety service. */
export const ORDINARY_TOPICS: readonly HelpTopic[] = HELP_TOPICS.filter((t) => t !== "not_safe");
