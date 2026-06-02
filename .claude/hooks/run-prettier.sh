#!/usr/bin/env bash
# PostToolUse hook: run prettier on the edited file (best-effort, non-blocking).

set -u

INPUT="$(cat || true)"

if command -v jq >/dev/null 2>&1; then
  FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.toolInput.file_path // .tool_input.file_path // ""')"
else
  FILE_PATH="$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')"
fi

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx|*.json|*.css|*.scss|*.md|*.html|*.yaml|*.yml|*.vue) ;;
  *) exit 0 ;;
esac

if command -v npx >/dev/null 2>&1; then
  npx --no-install prettier --write --log-level=warn "$FILE_PATH" >/dev/null 2>&1 || \
    npx -y prettier --write --log-level=warn "$FILE_PATH" >/dev/null 2>&1 || true
elif command -v prettier >/dev/null 2>&1; then
  prettier --write --log-level=warn "$FILE_PATH" >/dev/null 2>&1 || true
fi

exit 0
