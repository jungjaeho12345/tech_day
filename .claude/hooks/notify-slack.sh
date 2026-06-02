#!/usr/bin/env bash
# PostToolUse hook: post current operation status to Slack tech-day channel.
# Non-blocking: never fails the tool call. Requires SLACK_BOT_TOKEN env var,
# or falls back to SLACK_WEBHOOK_URL. If neither is set, logs locally.

set -u

INPUT="$(cat || true)"
CHANNEL_ID="${SLACK_TECHDAY_CHANNEL_ID:-C0B69CG59UM}"

if command -v jq >/dev/null 2>&1; then
  TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.toolName // .tool_name // ""')"
  FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.toolInput.file_path // .tool_input.file_path // ""')"
else
  TOOL_NAME="$(printf '%s' "$INPUT" | grep -oE '"tool[_]?[Nn]ame"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')"
  FILE_PATH="$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')"
fi

TS="$(date '+%Y-%m-%d %H:%M:%S')"
TEXT=":robot_face: [tech_day] ${TOOL_NAME} 완료 — ${FILE_PATH:-(no file)} @ ${TS}"

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.moai/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "$TEXT" >> "$LOG_DIR/slack-notify.log" 2>/dev/null || true

# Path 1: Bot token
if [ -n "${SLACK_BOT_TOKEN:-}" ]; then
  curl -sS -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$(jq -n --arg ch "$CHANNEL_ID" --arg t "$TEXT" '{channel:$ch, text:$t}')" \
    >/dev/null 2>&1 || true
  exit 0
fi

# Path 2: Webhook
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -sS -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    --data "$(jq -n --arg t "$TEXT" '{text:$t}')" \
    >/dev/null 2>&1 || true
  exit 0
fi

# Path 3: log-only fallback
exit 0
