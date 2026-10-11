# @teenbuddy/llm

The only module in the tree that talks to a language model.

## Two rules, enforced here so nowhere else has to think about them

**1. No hosted inference API.** Calls go to the Claude Code CLI already
installed on the machine. A teenager's words do not travel to a third-party
endpoint, and there is no API key in this repo to leak.

`das.md` mentions adding the DeepSeek API later. The slot is in
`resolveProvider` with a comment explaining what that decision actually means:
it sends teenagers' messages to a third party, so it is a deliberate choice, not
a config change. Implementing it is one new file satisfying `Provider` and one
line in the switch — nothing else in the tree moves, because every consumer
takes a `complete` function rather than a provider.

**2. Always the most capable model.** No silent downgrade for cost. This model
reads messages from teenagers in distress and the small model is measurably
worse at exactly the veiled cases that matter most.

## The subprocess is treated as hostile

Not because it is malicious, but because a subprocess genuinely can: hang, exit
non-zero, print to stderr and still succeed, emit a JSON envelope or bare text,
or not exist at all. Each is handled here rather than by the caller.

- **The prompt goes on stdin, never in argv.** A teenager's message must not
  appear in a process listing. There is a test for it.
- **Binary resolution**: `$TEENBUDDY_CLAUDE_BIN` → `$PATH` → common install
  paths → a clear "not found, set this variable" message. `$PATH` is scanned
  in-process rather than via `command -v`, avoiding a shell entirely.
- **Timeouts are never retried.** The caller has already spent that budget, and
  retrying doubles a teenager's wait on a typing indicator. Only `failed` and
  `empty` retry.

## Providers

| id | What it is |
| --- | --- |
| `claude-code` | Default. Spawns the local CLI. |
| `stub` | Deterministic canned replies. `TEENBUDDY_LLM_PROVIDER=stub`. |

The stub is what makes gate tests free and lets the web app run with no CLI
installed. It is not a mock hidden in a test file: it is selectable at runtime,
because "develop the whole app offline" is a real requirement.

## Where it would break

- **The CLI's output format changing.** `parseCliOutput` reads `result`, `text`
  or `content` from a JSON envelope and falls back to treating the raw stdout as
  the answer. A rename to an unknown field degrades to returning the raw JSON as
  text rather than returning nothing — visible and wrong rather than silent and
  empty.
- **Concurrency.** Every call spawns a process. A dozen simultaneous teenagers
  means a dozen CLI processes. There is no pool and no queue; that is the first
  thing to add before this serves more than a handful of people at once.
- **Cold start.** The CLI takes seconds, not milliseconds. The safety gate is
  designed around this: tier 1 answers instantly and the model only ever refines.

## Test

```bash
npm test --workspace @teenbuddy/llm
```

27 tests, all free — the subprocess is injected as a fake runner.
