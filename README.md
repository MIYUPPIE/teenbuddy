# TeenBuddy

> A safe daily companion for teenagers that helps them manage emotions, resist
> unhealthy impulses, build positive habits, and ask for help when they need it.

An implementation of the product brief in [`das.md`](./das.md): Next.js and
Firebase, six screens, a controlled AI coach, and a safety system designed in
from the first commit rather than added later.

```bash
npm install
npm run gate                              # 440 tests, ~2s, free
npm run dev --workspace @teenbuddy/web    # http://localhost:3000
```

No configuration. No account, no Firebase project, no API key.

## What is here

| | |
| --- | --- |
| Six screens | Home, Check-in, Help Now, Learn, Journal, Profile |
| Content | 25 lessons, a 28-day challenge rotation, 8 coping interventions |
| Safety | Two-tier risk classification, reviewed crisis templates, region-aware resources |
| Coach | A model kept inside deterministic rails |
| Tests | 440 gate tests, ~2s, zero cost |
| Evals | A 42-case labelled safety corpus and a model-judged coach rubric |

## Layout

```
contracts/          the only thing services share: schemas and types, zero deps
services/
  progress/         streaks, growth bars, achievements   (pure, no clock, no IO)
  content/          lessons, challenges, interventions   (static + deterministic selection)
  safety/           two-tier risk classification         (tier 1 always runs)
  llm/              the only module that calls a model   (local Claude Code CLI)
  coach/            the Teen Support Coach               (orchestration + output checks)
apps/web/           Next.js 15 App Router + Firebase
scripts/            gate.sh, eval.sh, check-strip.ts
```

Each service owns its code, tests, evals and README, and imports nothing from
another service — only from `contracts/`. Two sessions can work in
`services/safety/` and `services/content/` without colliding.

## The three decisions that shape everything

### 1. A crisis reply is a constant, not a generation

```
assess → [crisis? reviewed template, STOP] → model → check → assess the reply
```

At `crisis` the model is never called. `CoachReplySchema` requires
`source: "template"` at that level, so an improvised crisis response cannot be
constructed, let alone rendered — the shape rejects it.

The model tier of the safety gate can only ever **raise** a risk level, never
lower it. A prompt injection, a timeout, a swapped model, or a provider
returning `null` cannot talk the system down from a crisis. Tests cover every
level a model can return.

### 2. Deterministic work is code, not prompts

Everything that is same-input-same-output lives in a tested pure function:
streak arithmetic, timezone handling, the growth formula, which challenge today
is, the explicit-risk lexicon. Only two things are genuinely latent — the coach's
tone and veiled-risk detection — and both are isolated behind their own eval
suites.

The clearest case is dates. A streak that breaks at midnight for a teen in Lagos
but not one in London is not a bug you find by clicking around, so instants are
converted to civil dates **once**, using the teen's own IANA zone, and everything
after is integer arithmetic no DST transition can perturb. Around 90 tests pin
it against UTC+14, UTC−11, the +05:45 and +12:45 zones, both US DST
transitions, leap days and year boundaries.

### 3. Privacy is the default, not a setting

Every consent in `DEFAULT_PRIVACY` is `false`. Storage is local unless someone
deliberately configures Firebase. `JournalEntry` has no sharing field at all.
Nothing reaches a trusted adult without the teen sending it, and a support
request carries only the message they wrote. "Erase everything" is a real button
that really erases.

## A teen's mood never lowers a score

Worth stating on its own, because it is the product decision most easily lost in
a refactor. A growth bar that fell because someone felt sad would punish honesty
in an app whose entire value depends on honest check-ins. So `wellbeing`
measures the *practice* of checking in, never the content of it — no mood value
is even passed to `computeGrowth`, which makes it structurally impossible rather
than merely intended.

Escalating a hard moment to a human counts *toward* the Mind bar, for the same
reason: reaching for a person is the healthiest available outcome, not a failure.

## Two test lanes

```bash
npm run gate     # deterministic, local, free, ~2s. Every commit.
npm run eval     # calls a real model, slower, has pass thresholds. Before ship + nightly.
```

The gate includes a strip-only syntax check. `node --check` is not enough: it
accepts a TypeScript parameter property that then crashes at import with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. That bug shipped once here, so the check now
runs the real transform.

The evals report **SKIPPED** and say what is unverified when no model is
available, rather than passing silently.

## No build step for the services

Node 25 runs TypeScript directly, so `contracts/` and `services/` ship source
and are tested with `node --test` — no bundler, no transpile, no watch process,
no external test dependency. Next compiles the same files via
`transpilePackages`, so `npm run gate` and `next dev` read identical source.

## Known gaps

These are real and listed rather than buried. Each service README has its own
"Where it would break" section.

- **No clinical review.** The lessons, the crisis templates and the coach prompt
  are written to be accurate and non-clinical, but no adolescent psychologist or
  crisis professional has reviewed them. This is a prerequisite for real users.
- **Crisis numbers need verifying.** `services/safety/src/resources.ts` carries
  `LAST_VERIFIED` and a test that fails once the table is 180 days stale.
  Nigeria deliberately carries only `112` plus `findahelpline.com`, because this
  repo will not hard-code an NGO number it cannot verify with the operator.
- **English only.** The tier-1 lexicon covers no other language. A teen writing
  in Yoruba or Pidgin depends entirely on the model tier. Largest known gap.
- **No real authentication.** Local storage uses a device-scoped random id.
- **Support requests are stored, not delivered.** Sending needs a server-side
  sender and adult verification — Phase 3 in the spec's own ordering.
- **Veiled-risk coverage is unverified on this machine**, because the Claude Code
  CLI is not installed here. The deterministic lane gates at 100% recall and 0%
  false positives; the model lane has never run.

## Phases, against the spec

`das.md` proposes four. Phase 1 and 2 are here.

| Phase | Status |
| --- | --- |
| 1 — profile, check-in, challenge, lessons, journal, progress | done |
| 2 — AI coach, Help Now, trigger detection | done |
| 3 — trusted adults, safety escalation, guardian controls | escalation and trusted-person selection done; **delivery and guardian controls not built** |
| 4 — community, gamification, advanced personalisation | not started |
