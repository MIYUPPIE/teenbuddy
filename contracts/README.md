# @teenbuddy/contracts

The shared boundary. Every service imports types and validators from here, and
from nowhere else in the tree.

## Why it exists

Services in this repo are meant to be worked on in parallel sessions without
collisions. That only holds if the shape of the data between them is written
down in exactly one place. This package is that place.

Rules:

- No IO. No `fetch`, no `fs`, no Firebase. Pure shapes and pure helpers.
- No dependencies. It has to import cleanly from a Next.js server component, a
  browser bundle, and a bare `node --test` run with no install step.
- Changing a stored shape is a coordinated change: bump `SCHEMA_VERSION`, update
  every consumer, ship it in one commit.

## Layout

| File | What is in it |
| --- | --- |
| `src/validate.ts` | The zero-dependency validation kernel. |
| `src/enums.ts` | Closed vocabularies plus their display labels. |
| `src/records.ts` | The stored document shapes and the request/reply shapes. |

## The two date fields

Every dated record carries both, and they answer different questions:

- `localDate` — `"YYYY-MM-DD"` in the teen's own timezone. Answers *which day was
  this for them*. Streaks, "today's challenge" and the check-in gate all read
  this and only this.
- `createdAt` — an ISO-8601 instant. Answers *in what order did this happen*.

Deriving one from the other inside a component is the bug this split exists to
prevent: a teen in Lagos checking in at 00:30 has a different "today" from the
UTC server that stored the row.

## Rules the schemas enforce on their own

These are not conventions, they are validation failures:

- A mood cause of `other` requires a note; `dont_know` cannot be combined with a
  specific cause.
- A `CoachReply` at `elevated` or `crisis` risk must carry an `escalation`.
- A `CoachReply` at `crisis` risk must have `source: "template"`. **A model is
  structurally incapable of authoring a crisis response** — the shape rejects it
  before it can be stored or rendered.
- `SafetyVerdict.tiers` cannot be empty; a verdict must say where it came from.
- Every privacy consent in `DEFAULT_PRIVACY` is `false`.

`object()` strips unknown keys rather than rejecting them, so a record written
by an older client still loads, and a key someone appends to a payload never
reaches storage.

## Tests

```bash
npm test --workspace @teenbuddy/contracts
```

Free, deterministic, no network.
