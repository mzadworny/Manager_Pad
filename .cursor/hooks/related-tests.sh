#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
FILE=$(node "$HOOK_DIR/parse-file-path.mjs")

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "${FILE##*.}" in
  ts|tsx|js|jsx) ;;
  *) exit 0 ;;
esac

rel="${FILE#"$PWD"/}"
case "$rel" in
  src/*|tests/unit/*) ;;
  *) exit 0 ;;
esac

set +e
output=$(AI_AGENT=1 npx vitest related "$FILE" --run tests/unit 2>&1)
status=$?
set -e

if [[ $status -eq 0 ]]; then
  exit 0
fi

if printf '%s' "$output" | grep -qiE 'no test files found|no tests found related|no tests were found'; then
  exit 0
fi

printf '%s' "$output" | node "$HOOK_DIR/emit-context.mjs" "Related unit tests failed after editing ${rel}:"
exit 0
