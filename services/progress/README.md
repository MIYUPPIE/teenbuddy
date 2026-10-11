# @teenbuddy/progress

Streaks, the four growth bars, and achievements. Pure functions over counts.

## Why this is a service and not a hook

Every number here is same-input-same-output by definition, which makes it
deterministic work. It is also the part most likely to be quietly wrong in
production and impossible to reproduce: a streak that breaks at midnight for a
teen in Lagos but not for one in London is not a bug you find by clicking
around. So it lives here, behind ~90 tests that can sit on any date in any
timezone, and the UI only renders what it returns.

No clock, no IO, no randomness. `now` and `timeZone` are arguments.

## The date rule

```
instant  --localDateOf(now, tz)-->  civil date  --addDays/diffDays-->  civil date
```

Convert **once**, at the edge, with the teen's own IANA zone. Everything after
that is integer arithmetic on the civil calendar, which no DST transition can
perturb. `addDays("2026-03-07", 1)` is `"2026-03-08"` in every zone on earth;
adding 86,400,000 milliseconds is not.

Tests pin this against UTC+14, UTC-11, the +05:45 and +12:45 zones, both US DST
transitions, leap days, and year boundaries.

## Streak rules

| Situation | Result |
| --- | --- |
| Checked in today | streak counts back from today |
| Checked in yesterday, not today | streak **stays alive**, `atRisk: true` |
| Last check-in 2+ days ago | `current: 0`, `longest` preserved |
| Several check-ins in one day | counted once |
| Row dated in the future | ignored (a wrong device clock cannot inflate a streak) |

`longest` is monotonic. A test walks 21 days of history and asserts it never
decreases.

## Growth bars

Four independent views over a rolling 14-day window, not a partition, so a
`mind` lesson feeds both Mind and Learning.

| Pillar | Counts | 100% at |
| --- | --- | --- |
| Mind | mind + personal-growth lessons, and Help Now sessions seen through | 6 |
| Wellbeing | days with a check-in | 14 |
| Habits | daily challenges completed | 10 |
| Learning | lessons of any category | 7 |

**A teen's mood never lowers a bar.** A score that fell because someone felt sad
would punish honesty in an app whose entire value depends on honest check-ins,
so `wellbeing` measures the practice of checking in, never the content of it. No
mood value is even passed to `computeGrowth`, which makes it structurally
impossible rather than merely intended. Escalating a hard moment to a human
counts toward Mind for the same reason: reaching for a person is the healthiest
outcome available, not a failure.

The window rolls, so a rough fortnight fades instead of following someone
around, and a dormant account reads as dormant rather than permanently
excellent.

## Where it would break

- **A profile with no timezone.** `localDateOf` throws `RangeError` rather than
  falling back to the server zone, because a silent fallback is the exact bug
  that costs someone their streak. Callers must have a profile first.
- **A teen who travels across the date line.** Their "today" shifts with the
  profile zone, so a streak can gain or skip a day. Deliberate: the alternative
  is telling someone in Auckland that their day ended at 11am.
- **Lifetime totals over a very long history.** Everything recomputes from raw
  records; at tens of thousands of rows the caller should page or precompute.
  Nothing here caches, by design, so the numbers can never drift from the data.

## Test

```bash
npm test --workspace @teenbuddy/progress
```
