#!/usr/bin/env bash
# Gate tests: deterministic, local, free, fast. Run on every commit.
# Nothing here touches the network or a language model.
set -uo pipefail
cd "$(dirname "$0")/.."

PACKAGES=(contracts services/progress services/content services/safety services/llm services/coach apps/web)
STARTED=$(date +%s%N)
FAILED=()
TOTAL=0

printf '\n\033[1mTeenBuddy gate\033[0m\n\n'

# Every source file must survive Node's strip-only type stripping. `node --check`
# is not enough - it accepts a parameter property that then crashes at import.
printf '  %-24s' "strip-only syntax"
if OUTPUT=$(node --no-warnings scripts/check-strip.ts 2>&1); then
  printf '\033[32mok\033[0m (%s)\n' "$OUTPUT"
else
  printf '\033[31mFAIL\033[0m\n%s\n' "$OUTPUT"
  FAILED+=("strip-only syntax")
fi

for pkg in "${PACKAGES[@]}"; do
  printf '  %-24s' "$pkg"
  OUTPUT=$(cd "$pkg" && node --test 2>&1)
  PASS=$(echo "$OUTPUT" | grep -oP '^ℹ pass \K\d+' | tail -1)
  FAIL=$(echo "$OUTPUT" | grep -oP '^ℹ fail \K\d+' | tail -1)
  TOTAL=$((TOTAL + ${PASS:-0}))
  if [ "${FAIL:-1}" != "0" ]; then
    printf '\033[31mFAIL\033[0m (%s failed)\n' "${FAIL:-?}"
    echo "$OUTPUT" | grep -A6 '✖ failing tests:' | head -40
    FAILED+=("$pkg")
  else
    printf '\033[32m%s passed\033[0m\n' "${PASS:-0}"
  fi
done

ELAPSED=$(( ($(date +%s%N) - STARTED) / 1000000 ))
printf '\n  %s tests in %sms\n\n' "$TOTAL" "$ELAPSED"

if [ ${#FAILED[@]} -gt 0 ]; then
  printf '\033[31m  gate failed: %s\033[0m\n\n' "${FAILED[*]}"
  exit 1
fi
printf '\033[32m  gate green\033[0m\n\n'
