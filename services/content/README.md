# @teenbuddy/content

The lesson library, the daily challenge rotation, the Help Now interventions,
and the rules for choosing between them.

## What is in it

| | Count | Notes |
| --- | --- | --- |
| Lessons | 25 | Every category in the spec: Mind 5, Digital life 6, Relationships 5, School 4, Personal growth 5 |
| Challenges | 28 | A four-week rotation, one per day |
| Interventions | 8 | One per Help Now topic, except `not_safe` |

## Selection is deterministic

"Today's challenge" must be the same challenge every time the app opens, on
every device, all day. `Math.random()` would give a different one on every
React paint. So the index is derived from the civil date:

```
index = (ordinal(localDate) - ordinal(ANCHOR)) mod length
```

Nothing here reads a clock; the caller passes the date it got from
`@teenbuddy/progress`. Tests assert a full rotation visits every item exactly
once, that consecutive days differ, that it repeats after exactly 28 days, and
that dates before the anchor work (a naive `%` returns a negative index and
hands back `undefined`).

`ROTATION_ANCHOR` must never change. Moving it reshuffles everyone's history.

## The `not_safe` hole is deliberate

There is no intervention for "I don't feel safe", and `interventionFor` returns
`null` for it. That null is an instruction, not a gap: `helpRouteFor` turns it
into `{ route: "safety" }` and the caller hands off to `@teenbuddy/safety`.

Offering a breathing exercise to a teen who has just said they are in danger is
the worst thing this screen could do, so the contract makes it unrepresentable:
`InterventionSchema` **rejects** any object with `topic: "not_safe"`. A future
contributor cannot add one by accident, and a test proves it.

## Content rules, enforced by test

- Stated `minutes` must equal `ceil(words / 100)`, clamped to 1..3. No lesson
  can claim to be a 2-minute read while being a 900-word essay.
- Every ordinary help topic has at least one lesson behind it. This caught a
  real gap: `want_to_cry` had none.
- No lesson may diagnose the reader (`/you have (depression|adhd|…)/`).
- Every intervention offers a route to a human in its `nextSteps`.
- Intervention script lines are ≤160 characters, because they are read by
  someone who is not at their best.
- At least a quarter of challenges are prosocial, so "Helped Someone" is
  reachable without hunting.

## Where it would break

- **Adding a 26th lesson.** `dailyLesson` uses a stride of 7 over the library
  length; 7 and 25 are coprime so the cycle visits everything. 7 and 28 are not.
  The "one cycle visits every lesson exactly once" test fails loudly if a new
  count breaks coprimality — pick a stride that is coprime with the new length.
- **Localisation.** All content is English and none of it is externalised.
  Translating means a `locale` dimension on every lookup.
- **Editorial review.** These lessons are written to be accurate and
  non-clinical, but nothing here has been reviewed by an adolescent
  psychologist. That review is a prerequisite for shipping to real teens.

## Test

```bash
npm test --workspace @teenbuddy/content
```
