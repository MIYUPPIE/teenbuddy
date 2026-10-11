# @teenbuddy/safety

The gate every teen message passes through, and the only module allowed to
decide that something is a crisis.

## The contract with the rest of the app

> Nothing reaches the coach model, and nothing reaches a screen, without an
> assessment. At `crisis`, the model is not called at all and a reviewed
> template is rendered instead.

## Two tiers, and the ordering is the design

```
normalise → blank idioms → lexicon rules → guards →  ┐
                                                      ├→ maxRisk → verdict
                       (only if not already crisis) → ┘
                          model classifier
```

**Tier 1** is deterministic: free, instant, offline, identical on every call. It
runs first so that "I want to kill myself" never depends on a network, a
timeout, a rate limit, or a model's mood.

**Tier 2** is a model, and it exists for the cases a lexicon structurally cannot
reach — *"I've written letters to everyone and I finally feel calm"* contains no
risk vocabulary at all and is one of the most serious things a teenager can say.

Three properties make tier 2 safe to depend on:

1. **It can only raise.** `maxRisk` cannot return less than tier 1 produced. A
   prompt injection, a jailbreak, a swapped model, or a bad prompt cannot talk
   the system down from a crisis. There is a test for every level a model can
   return.
2. **It is injected, not imported.** Gate tests run against a fake and cost
   nothing.
3. **Every failure resolves to `none` and is reported.** Timeout, malformed
   JSON, unknown level, provider returning `null` — tier 1 has already run, so a
   tier-2 outage degrades coverage without ever blocking a reply.

Tier 2 is skipped entirely when it cannot help: already crisis, no provider, or
a message too short to carry veiled meaning.

## Normalisation keeps every reading

`1` is both `i` and `l`, and a stretched `diiiiie` is both `diie` and `die`.
Rather than guess, `normalize` returns every reading and a rule matches if any
form matches. Guessing wrong means missing `kill myse1f`, which is the exact
failure this file exists to prevent.

Crisis phone numbers survive normalisation intact — substitution only applies
next to a letter, so `988` and `116 123` are never mangled into words.

Deliberately **not** done: stemming, fuzzy matching, edit distance. All trade
precision for recall, and a false alarm teaches a teenager that the button lies.

## Guards downgrade, they never silence

| Input | Result | Why |
| --- | --- | --- |
| `I don't want to kill myself` | `elevated` | Ambivalence, not safety |
| `I used to cut myself` | `elevated` | A disclosure still deserves a person |
| `for my english essay, a character who wants to die` | `elevated` | Fiction framing, still visible |
| `my feet are killing me` | `none` | Idiom, unambiguous |
| `I don't feel safe` | `crisis` | The negation **is** the disclosure |

A guarded crisis lands at `elevated`, never `none`. Danger and abuse rules are
`guardable: false` and cannot be downgraded at all.

**Third-party re-attribution:** `my friend wants to die` scores `elevated` via
`third-party-risk`, not `crisis`, because rendering "Are *you* safe right now?"
to a worried friend is both wrong and alienating. The disclosure is never lost —
a test asserts that suppression can never land below `elevated`.

## Crisis responses are constants

`templates.ts` is the only thing that can satisfy `CoachReplySchema`'s
requirement that a crisis reply has `source: "template"`. A model can be
injected, can hallucinate a helpline number, can time out, or can be quietly
swapped for a cheaper one. A constant cannot.

The wording follows what crisis lines train people to do: say you heard it, ask
directly about immediate danger, give one concrete next step, and stay. Tests
assert it never says "calm down", never claims to be a clinician, and never
promises an outcome.

## ⚠️ Crisis numbers need human verification

`resources.ts` carries `LAST_VERIFIED` and a gate test that **fails** once the
table is more than 180 days old. A wrong number in a crisis is worse than no
number, so this is a deliberate tripwire.

Nigeria intentionally carries only `112` plus the international directory: this
file will not hard-code an NGO helpline number it cannot verify with the
operator. Do not add one without checking it.

The international directory (`findahelpline.com`) is appended to every region,
so no input — unknown code, empty string, `null` — can produce an empty list.

## Where it would break

- **Languages other than English.** The lexicon is English-only. A teen writing
  in Yoruba, Pidgin, or French gets tier-1 coverage of roughly nothing and
  depends entirely on the model tier. This is the largest known gap.
- **A brand new euphemism.** Teen slang for self-harm turns over quickly. Tier 2
  covers some of it; the lexicon needs periodic review against real data.
- **Sarcasm and reported speech.** `"my brother keeps saying kill yourself"` is
  bullying, and tier 1 scores it `crisis`. Over-escalation, by design.
- **No clinical review.** Nothing here has been reviewed by a crisis
  professional. That review is a prerequisite for shipping to real teenagers.

## Test and eval

```bash
npm test --workspace @teenbuddy/safety   # 110 gate tests, free
npm run eval --workspace @teenbuddy/safety   # 42-case labelled corpus, calls a model
```

The eval gates on 100% crisis recall and 0% false positives for tier 1, and on
100% recall including veiled cases with the model. A missed crisis fails the run
outright, whatever the aggregate says.
