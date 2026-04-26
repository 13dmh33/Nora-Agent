#!/usr/bin/env bash
# Simulates Twilio webhook POSTs to test the /api/sms route locally.
#
# Usage:
#   ./test/sms-test.sh          # scripted full-booking walkthrough
#   ./test/sms-test.sh -i       # interactive — type your own messages
#
# Prerequisites:
#   - Dev server running: cd nora-agent && npm run dev
#   - ANTHROPIC_API_KEY set in nora-agent/.env.local (required)
#   - Cal_API set in .env.local for real slot fetching (optional)
#   - RESEND_API_KEY + CONTRACTOR_EMAIL for email notification (optional)

set -euo pipefail

BASE_URL="${NORA_URL:-http://localhost:3000}"
SMS_URL="$BASE_URL/api/sms"
FROM_PHONE="${TEST_PHONE:-+15550001234}"

# ── helpers ───────────────────────────────────────────────────────────────────

send() {
  local body="$1"
  echo ""
  echo ">>> YOU: $body"
  local response
  response=$(curl -s -X POST "$SMS_URL" \
    --data-urlencode "From=$FROM_PHONE" \
    --data-urlencode "Body=$body" \
    -H "Content-Type: application/x-www-form-urlencoded")

  # Extract text from TwiML <Message>...</Message>
  local text
  text=$(echo "$response" | grep -o '<Message>[^<]*</Message>' | sed 's/<[^>]*>//g' || true)
  if [[ -z "$text" ]]; then
    echo "<<< NORA: [no message — raw response below]"
    echo "$response"
  else
    echo "<<< NORA: $text"
  fi
}

check_server() {
  if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "^[23]"; then
    echo "ERROR: Dev server not reachable at $BASE_URL"
    echo "       Run: cd nora-agent && npm run dev"
    exit 1
  fi
}

# ── interactive mode ──────────────────────────────────────────────────────────

interactive() {
  echo "=== Nora SMS Interactive Test ==="
  echo "SMS URL : $SMS_URL"
  echo "FROM    : $FROM_PHONE"
  echo "Type your messages below. Ctrl+C to exit."
  echo ""

  # Start conversation
  send "Hi"

  while true; do
    echo ""
    printf ">>> YOU: "
    read -r user_input || break
    [[ -z "$user_input" ]] && continue
    send "$user_input"
  done
}

# ── scripted walkthrough ──────────────────────────────────────────────────────

scripted() {
  echo "=== Nora SMS Scripted Test ==="
  echo "SMS URL : $SMS_URL"
  echo "FROM    : $FROM_PHONE"
  echo ""
  echo "Walking through a full new-customer booking..."

  send "Hi there"
  sleep 1

  send "I have a leaking pipe under my kitchen sink"
  sleep 1

  send "It's routine, not an emergency"
  sleep 1

  send "My name is Alex Johnson"
  sleep 1

  send "alex.johnson@example.com"
  sleep 1

  send "123 Maple Street, Denver CO 80203"
  sleep 1

  # Claude should now call get_available_slots and present options
  echo ""
  echo "--- Nora should now show available slots ---"
  sleep 2

  send "I'll take option 1"
  sleep 2

  echo ""
  echo "=== Test complete ==="
  echo ""
  echo "Verify the following manually:"
  echo "  1. Nora responded with a booking confirmation"
  echo "  2. leads.json was updated (cat nora-agent/leads.json)"
  echo "  3. Contractor notification email was sent (check CONTRACTOR_EMAIL inbox)"
  echo "  4. Cal.com dashboard shows a new booking (if Cal_API is configured)"
}

# ── entrypoint ────────────────────────────────────────────────────────────────

check_server

if [[ "${1:-}" == "-i" ]]; then
  interactive
else
  scripted
fi
