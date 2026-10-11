#!/usr/bin/env bash
# Periodic evals: these call a real model, cost money, and are slower.
# Run before shipping and nightly. Not part of the commit gate.
set -uo pipefail
cd "$(dirname "$0")/.."

printf '\n\033[1mTeenBuddy evals\033[0m (these call a real model)\n\n'

STATUS=0
for suite in services/safety services/coach; do
  printf '\033[1m%s\033[0m\n' "$suite"
  (cd "$suite" && node evals/run.ts) || STATUS=1
  printf '\n'
done
exit $STATUS
