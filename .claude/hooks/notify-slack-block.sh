#!/usr/bin/env bash
# Slack block notifier: posts blocked/denied tool calls to the tech-day channel.
# Wired to: PermissionDenied hook (settings.json, stdin JSON mode) and
# block-dangerous.sh (direct invocation via NOTIFY_* env vars).
#
# Encoding: git-bash curl corrupts raw UTF-8 bytes via Windows code-page
# conversion, so the JSON body is built as pure-ASCII \uXXXX escapes (perl).
# Pure ASCII survives any code-page conversion. perl is shipped with git bash.
#
# Non-blocking: never fails the calling hook. Requires SLACK_BOT_TOKEN env var,
# or falls back to SLACK_WEBHOOK_URL. If neither is set, logs locally only.

set -u

CHANNEL_ID="${SLACK_TECHDAY_CHANNEL_ID:-C0B69CG59UM}"
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.moai/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Extract a JSON string value by key (escape-aware), then unescape \" and \\.
json_str() {
  printf '%s' "$INPUT" \
    | grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"(\\\\.|[^\"\\\\])*\"" \
    | head -1 \
    | sed -E "s/^\"$1\"[[:space:]]*:[[:space:]]*\"//; s/\"\$//" \
    | sed -e 's/\\"/"/g' -e 's/\\\\/\\/g'
}

# Encode stdin as an ASCII-only JSON string value: truncate to $1 chars,
# escape \ " newline, then \uXXXX-escape every non-ASCII byte. perl keeps
# the output pure ASCII so curl cannot corrupt it on Windows.
to_json_ascii() {
  if command -v perl >/dev/null 2>&1; then
    perl -CSD -e '
      my $max = ($ARGV[0] // 0) + 0;
      local $/; my $s = <STDIN>; $s = "" unless defined $s;
      $s = substr($s, 0, $max) if $max > 0 && length($s) > $max;
      $s =~ s/\\/\\\\/g; $s =~ s/"/\\"/g; $s =~ s/\r//g; $s =~ s/\n/\\n/g;
      $s =~ s/([^\x20-\x7e])/sprintf("\\u%04x", ord($1))/ge;
      print $s;
    ' "$1"
  else
    # Fallback (no perl): byte-escape only. May garble non-ASCII on Windows.
    sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR>1{printf "\\n"} {printf "%s", $0}'
  fi
}

if [ -n "${NOTIFY_EVENT:-}" ]; then
  # Direct invocation mode (e.g. from block-dangerous.sh).
  EVENT="$NOTIFY_EVENT"
  TOOL_NAME="${NOTIFY_TOOL:-?}"
  REASON="${NOTIFY_REASON:-}"
  TARGET="${NOTIFY_TARGET:-}"
else
  # Hook stdin JSON mode.
  INPUT="$(cat || true)"
  EVENT="$(json_str hook_event_name)"
  TOOL_NAME="$(json_str toolName)"
  [ -z "$TOOL_NAME" ] && TOOL_NAME="$(json_str tool_name)"
  REASON="$(json_str error)"
  [ -z "$REASON" ] && REASON="$(json_str tool_error)"
  [ -z "$REASON" ] && REASON="$(json_str reason)"
  TARGET="$(json_str command)"
  [ -z "$TARGET" ] && TARGET="$(json_str file_path)"
fi

TS="$(date '+%Y-%m-%d %H:%M:%S')"

# Observability: record every received event locally (for filter tuning).
printf '[%s] event=%s tool=%s reason=%.300s\n' "$TS" "${EVENT:-?}" "${TOOL_NAME:-?}" "${REASON:-}" \
  >> "$LOG_DIR/blocked-tools.log" 2>/dev/null || true

case "$EVENT" in
  PermissionDenied)
    LABEL="권한 거부 (auto mode)" ;;
  HookBlocked)
    LABEL="hook 차단" ;;
  *)
    # Unknown events: notify only when the error text looks like a block.
    if ! printf '%s' "$REASON" | grep -qiE 'hook|blocked|denied|차단|거부'; then
      exit 0
    fi
    LABEL="도구 차단" ;;
esac

TEXT=":no_entry: [tech_day] ${LABEL} — 도구: ${TOOL_NAME:-?} @ ${TS}
• 대상: ${TARGET:-(없음)}
• 사유: ${REASON:-(사유 미제공)}"

echo "$TEXT" >> "$LOG_DIR/slack-notify.log" 2>/dev/null || true

# Whole message escaped to pure-ASCII JSON string (char-safe truncation at 800).
ESC="$(printf '%s' "$TEXT" | to_json_ascii 800)"

# Path 1: Bot token (delivery result logged — silent failures are invisible otherwise)
if [ -n "${SLACK_BOT_TOKEN:-}" ]; then
  RESP="$(curl -sS -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"channel\":\"${CHANNEL_ID}\",\"text\":\"${ESC}\"}" 2>/dev/null || true)"
  printf '[%s] slack-delivery: %.200s\n' "$TS" "${RESP:-curl-failed}" \
    >> "$LOG_DIR/blocked-tools.log" 2>/dev/null || true
  exit 0
fi

# Path 2: Webhook
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -sS -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    --data "{\"text\":\"${ESC}\"}" >/dev/null 2>&1 || true
  exit 0
fi

# Path 3: log-only fallback
exit 0
