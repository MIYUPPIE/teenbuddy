# @teenbuddy/coach

The Teen Support Coach: a model kept inside deterministic rails.

## The whole service is one ordering

```
assess → [crisis? reviewed template, STOP] → model → check → assess the reply
```

A crisis reply is **never generated**. The safety gate runs before the model is
called, and at `crisis` the model is not called at all —
`CoachReplySchema` refuses `source: "model"` at that level, so an improvised
crisis response cannot be constructed, let alone rendered.

The second assessment is on the model's *own output*. A reply that would itself
read as crisis content does not get sent.

## The prompt is a request, not a guarantee

`COACH_SYSTEM` asks for the loop from `das.md` — listen, understand, calm,
suggest, encourage, escalate — and lists the hard rules. Every hard rule is then
re-checked in code, because the cost of a model diagnosing a teenager once in a
thousand replies is not a rounding error.

`check.ts` grades violations:

| Severity | Examples | What happens |
| --- | --- | --- |
| `replace` | diagnosis, claiming to be a therapist, promising secrecy, medication advice | the whole reply is discarded for a safe template |
| `strip` | "calm down", "at least…", "everything will be fine", "I understand how you feel" | that sentence is removed, the rest is kept |

Stripping is sentence-level, not phrase-level: cutting "calm down" out of
"you should calm down and breathe" leaves a fragment that reads as broken
software, which is its own kind of alarming.

The checks are written to allow discussing a condition without attributing one,
so a reply explaining what anxiety does to your chest is fine and
"you have anxiety disorder" is not. There is a test for that distinction.

## Failure modes all end in a readable reply

`respond` never throws and never returns without something a teenager can read.
No provider, a timeout, malformed output, empty output, a disallowed reply — all
resolve to a template. Tests cover each path, including a model returning `null`.

## Where it would break

- **Quality is not gated by the commit hook.** Only safety is. The reply-quality
  eval is judged by a model and lives in the paid lane, so a regression in tone
  ships and is caught nightly rather than at commit time. That is the deliberate
  split: quality is allowed to wobble, safety is not.
- **The checks are English regexes.** A diagnosis phrased unusually gets through
  the `replace` tier. The output safety assessment is the backstop.
- **No conversation memory by default.** `aiMayRememberConversations` is off
  until a teen turns it on, so the coach re-reads history from the request each
  turn and forgets everything otherwise. That is a privacy decision with a real
  usability cost, and it is the right side of that trade for this product.
- **Not clinically reviewed.** The system prompt encodes what a careful person
  would say, not what a trained youth worker would. Review before real users.

## Test and eval

```bash
npm test --workspace @teenbuddy/coach       # 45 gate tests, free
npm run eval --workspace @teenbuddy/coach   # 10 scenarios, model-judged
```

The eval fails on any hard-rule violation and on a mean quality below 3.8/5.
