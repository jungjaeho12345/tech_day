#!/usr/bin/env bash
# PreToolUse hook: block dangerous Bash commands.
# Reads JSON from stdin (toolName, toolInput). Exit 2 = block.

set -u

INPUT="$(cat || true)"

# Extract tool name and command (jq if available, otherwise grep fallback)
if command -v jq >/dev/null 2>&1; then
  TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.toolName // .tool_name // ""')"
  CMD="$(printf '%s' "$INPUT" | jq -r '.toolInput.command // .tool_input.command // ""')"
else
  TOOL_NAME="$(printf '%s' "$INPUT" | grep -oE '"tool[_]?[Nn]ame"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')"
  CMD="$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')"
fi

# Only inspect Bash invocations
if [ "${TOOL_NAME}" != "Bash" ]; then
  exit 0
fi

# Empty command - nothing to check
if [ -z "${CMD}" ]; then
  exit 0
fi

# Lowercase copy for case-insensitive matching
CMD_LC="$(printf '%s' "$CMD" | tr '[:upper:]' '[:lower:]')"

# Dangerous patterns (extended regex). Add cautiously.
DANGEROUS_PATTERNS=(
  'rm[[:space:]]+-[a-z]*r[a-z]*f?[[:space:]]+(/|~|\$home|c:[\\/]|/\*|~/\*)'
  ':\(\)[[:space:]]*\{[[:space:]]*:\|:&[[:space:]]*\}[[:space:]]*;:'   # fork bomb
  'mkfs(\.|[[:space:]])'
  'dd[[:space:]]+if=.*of=/dev/'
  '>[[:space:]]*/dev/sd[a-z]'
  'chmod[[:space:]]+-?r?[[:space:]]*777[[:space:]]+/'
  'git[[:space:]]+push[[:space:]]+(-f|--force)'
  'git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+(origin|upstream)'
  'git[[:space:]]+clean[[:space:]]+-fd'
  'drop[[:space:]]+database'
  'drop[[:space:]]+table'
  'truncate[[:space:]]+table'
  'delete[[:space:]]+from[[:space:]]+[a-z_]+[[:space:]]*;?[[:space:]]*$'
  'flushall'
  'flushdb'
  'shutdown([[:space:]]|$)'
  'reboot([[:space:]]|$)'
  'init[[:space:]]+0'
  'kill[[:space:]]+-9[[:space:]]+1([[:space:]]|$)'
  'curl[[:space:]]+[^|]*\|[[:space:]]*(sh|bash|zsh)'
  'wget[[:space:]]+[^|]*\|[[:space:]]*(sh|bash|zsh)'
)

for pat in "${DANGEROUS_PATTERNS[@]}"; do
  if printf '%s' "$CMD_LC" | grep -Eq -- "$pat"; then
    REASON="Blocked: command matches dangerous pattern (${pat})."
    # Emit reason via stdout JSON and exit 2 to deny.
    printf '{"reason":%s}\n' "\"$(printf '%s' "$REASON" | sed 's/"/\\"/g')\""
    >&2 echo "block-dangerous: $REASON"
    >&2 echo "block-dangerous: command=$CMD"
    exit 2
  fi
done

exit 0
