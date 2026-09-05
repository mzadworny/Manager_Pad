#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR=$(cd "$(dirname "$0")" && pwd)
FILE=$(node "$HOOK_DIR/parse-file-path.mjs")

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

npx prettier --write --ignore-unknown "$FILE"
