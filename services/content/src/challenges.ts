/**
 * The daily challenge rotation.
 *
 * "Don't give teenagers 30 things to do. Give them one small challenge per day."
 * So this is a 28-day loop of single, finishable actions. Four weeks is long
 * enough that nothing feels repetitive and short enough that every challenge
 * gets seen often enough to become familiar.
 *
 * Balance is enforced by test, not by hope: every pillar appears, no pillar
 * dominates, and at least a quarter of them involve another human, because
 * "Helped Someone" has to be reachable without hunting for it.
 */

import type { Challenge } from "@teenbuddy/contracts";

export const CHALLENGES: readonly Challenge[] = [
  // Week 1
  {
    id: "phone-away-30",
    prompt: "Put your phone in another room for 30 minutes.",
    pillar: "habits",
    minutes: 30,
    why: "Distance beats willpower. A phone you can see still costs you attention.",
    prosocial: false,
  },
  {
    id: "appreciate-someone",
    prompt: "Tell someone one specific thing you appreciate about them.",
    pillar: "wellbeing",
    minutes: 5,
    why: "Specific beats nice. \"You always notice when I go quiet\" lands; \"you're great\" doesn't.",
    prosocial: true,
  },
  {
    id: "walk-15",
    prompt: "Take a 15-minute walk with no destination.",
    pillar: "wellbeing",
    minutes: 15,
    why: "Walking changes what your thoughts do. Rumination is much harder in motion.",
    prosocial: false,
  },
  {
    id: "learn-20",
    prompt: "Spend 20 minutes learning something that isn't for school.",
    pillar: "learning",
    minutes: 20,
    why: "Curiosity you chose yourself is the kind that survives past exams.",
    prosocial: false,
  },
  {
    id: "gratitude-three",
    prompt: "Write down three things that went right today, however small.",
    pillar: "mind",
    minutes: 5,
    why: "Your brain files problems automatically and good days not at all. This corrects the filing.",
    prosocial: false,
  },
  {
    id: "message-first",
    prompt: "Message someone you've been meaning to talk to first.",
    pillar: "wellbeing",
    minutes: 5,
    why: "Most friendships fade from nobody going first, not from anything going wrong.",
    prosocial: true,
  },
  {
    id: "sleep-early-30",
    prompt: "Go to bed 30 minutes earlier than last night.",
    pillar: "habits",
    minutes: 30,
    why: "Almost every hard feeling is harder on short sleep. This is the cheapest fix there is.",
    prosocial: false,
  },

  // Week 2
  {
    id: "hardest-first",
    prompt: "Do the thing you've been avoiding first, before anything else.",
    pillar: "habits",
    minutes: 25,
    why: "Avoidance costs more attention all day than the task would have taken.",
    prosocial: false,
  },
  {
    id: "name-the-feeling",
    prompt: "Three times today, name what you're feeling in one specific word.",
    pillar: "mind",
    minutes: 5,
    why: "Precise naming measurably lowers the intensity. Vague naming raises it.",
    prosocial: false,
  },
  {
    id: "ask-a-question",
    prompt: "Ask one question you'd normally keep to yourself.",
    pillar: "learning",
    minutes: 2,
    why: "The question you're embarrassed to ask is usually the one others also need.",
    prosocial: true,
  },
  {
    id: "no-scroll-morning",
    prompt: "Don't open a feed until you've been awake for an hour.",
    pillar: "habits",
    minutes: 60,
    why: "The first thing you look at sets the tone. Let it be something you chose.",
    prosocial: false,
  },
  {
    id: "outside-20",
    prompt: "Spend 20 minutes outside, phone in your pocket.",
    pillar: "wellbeing",
    minutes: 20,
    why: "Daylight resets the clock that decides when you'll be able to sleep.",
    prosocial: false,
  },
  {
    id: "teach-something",
    prompt: "Explain something you understand well to someone who doesn't.",
    pillar: "learning",
    minutes: 10,
    why: "Explaining exposes the gaps in your own understanding faster than re-reading.",
    prosocial: true,
  },
  {
    id: "tidy-one-thing",
    prompt: "Tidy one surface. Just one. Then stop.",
    pillar: "habits",
    minutes: 10,
    why: "A small finished thing is proof you can finish things, on a day short of proof.",
    prosocial: false,
  },

  // Week 3
  {
    id: "write-it-down",
    prompt: "Write for five minutes about whatever is loudest. Don't edit it.",
    pillar: "mind",
    minutes: 5,
    why: "Getting it onto paper frees the working memory it's been occupying.",
    prosocial: false,
  },
  {
    id: "check-on-someone",
    prompt: "Check on someone who's been quiet lately.",
    pillar: "wellbeing",
    minutes: 10,
    why: "The person who's gone quiet is usually waiting for someone to notice.",
    prosocial: true,
  },
  {
    id: "mute-one-account",
    prompt: "Mute one account that reliably makes you feel worse.",
    pillar: "habits",
    minutes: 2,
    why: "You're allowed to. They will never find out.",
    prosocial: false,
  },
  {
    id: "retrieval-practice",
    prompt: "Close the book and write down what you remember. Then check.",
    pillar: "learning",
    minutes: 15,
    why: "It feels worse than re-reading and works several times better.",
    prosocial: false,
  },
  {
    id: "say-no-once",
    prompt: "Say no to one thing, without explaining yourself.",
    pillar: "mind",
    minutes: 2,
    why: "A reason invites negotiation. A plain no doesn't.",
    prosocial: false,
  },
  {
    id: "move-20",
    prompt: "Move your body hard enough to be out of breath for 20 minutes.",
    pillar: "wellbeing",
    minutes: 20,
    why: "It burns off the stress chemistry that talking about it leaves in place.",
    prosocial: false,
  },
  {
    id: "thank-an-adult",
    prompt: "Thank an adult who has actually helped you, and say what for.",
    pillar: "wellbeing",
    minutes: 5,
    why: "It also quietly makes them easier to go to next time you need something.",
    prosocial: true,
  },

  // Week 4
  {
    id: "plan-tomorrow-three",
    prompt: "Write down the three things that matter tomorrow. Only three.",
    pillar: "habits",
    minutes: 5,
    why: "A list of three gets done. A list of twelve gets avoided.",
    prosocial: false,
  },
  {
    id: "two-minute-start",
    prompt: "Start the thing you're dreading and allow yourself to stop after two minutes.",
    pillar: "habits",
    minutes: 2,
    why: "Starting is the hard part. Unfinished things nag at you into continuing.",
    prosocial: false,
  },
  {
    id: "compliment-yourself",
    prompt: "Write one honest sentence about something you handled well recently.",
    pillar: "mind",
    minutes: 5,
    why: "Your brain deletes evidence that contradicts what it already believes about you.",
    prosocial: false,
  },
  {
    id: "phone-out-of-bedroom",
    prompt: "Charge your phone outside your bedroom tonight.",
    pillar: "habits",
    minutes: 5,
    why: "It removes the 1am decision entirely, rather than asking you to win it.",
    prosocial: false,
  },
  {
    id: "sit-with-boredom",
    prompt: "Be bored for ten minutes on purpose. No screen, no music.",
    pillar: "mind",
    minutes: 10,
    why: "Boredom is where your own thoughts finally get a turn.",
    prosocial: false,
  },
  {
    id: "invite-someone",
    prompt: "Invite someone to do something, even something small.",
    pillar: "wellbeing",
    minutes: 10,
    why: "Waiting to be invited is the most common way to be lonely in a crowd.",
    prosocial: true,
  },
  {
    id: "one-page",
    prompt: "Read one page of anything that isn't on a screen.",
    pillar: "learning",
    minutes: 5,
    why: "One page is small enough that you can't talk yourself out of it.",
    prosocial: false,
  },
];

export const CHALLENGE_BY_ID: ReadonlyMap<string, Challenge> = new Map(
  CHALLENGES.map((c) => [c.id, c]),
);

/** The rotation length. Also the number of days before a challenge repeats. */
export const ROTATION_DAYS = CHALLENGES.length;
