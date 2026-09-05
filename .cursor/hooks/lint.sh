#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
FILE=$(node "$HOOK_DIR/parse-file-path.mjs")

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "${FILE##*.}" in
  ts|tsx|js|jsx|astro) ;;
  *) exit 0 ;;
esac

npx eslint --fix --quiet "$FILE"
