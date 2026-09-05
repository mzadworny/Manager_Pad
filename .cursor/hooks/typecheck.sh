#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
FILE=$(node "$HOOK_DIR/parse-file-path.mjs")

if [[ -z "$FILE" ]]; then
  exit 0
fi

case "${FILE##*.}" in
  ts|tsx|js|jsx|astro) ;;
  *) exit 0 ;;
esac

set +e
output=$(npx tsc --noEmit 2>&1)
status=$?
set -e

if [[ $status -eq 0 ]]; then
  exit 0
fi

printf '%s' "$output" | node "$HOOK_DIR/emit-context.mjs" "Typecheck failed after editing ${FILE}:"
exit 0
