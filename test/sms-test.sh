#!/usr/bin/env bash
# Simulates a Twilio SMS webhook conversation against the local dev server.
#
# Usage:
#   ./test/sms-test.sh              # Run scripted happy-path conversation
#   ./test/sms-test.sh -i           # Interactive mode — type each message yourself
#   SMS_URL=http://... ./test/sms-test.sh   # Override server URL
#
# Prerequisites:
#   1. Start the dev server: cd nora-agent && npm run dev
#   2. ANTHROPIC_API_KEY must be set in nora-agent/.env.local

set -euo pipefail

BASE_URL="${SMS_URL:-http://localhost:3000/api/sms}"
FROM="+15005550006"   # Fake sender (not in customers.json, so routes to AI)
TO="+15005550004"     # Fake Twilio receiving number

# ── Helpers ───────────────────────────────────────────────────────────────────

extract_message() {
  sed -n 's|.*<Message>\(.*\)</Message>.*|\1|p'
}

send() {
  local body="$1"
  printf '\n\033[1;34m>>> YOU:\033[0m %s\n' "$body"

  raw=$(curl -s -X POST "$BASE_URL" \
    --data-urlencode "From=$FROM" \
    --data-urlencode "To=$TO" \
    --data-urlencode "Body=$body" \
    --data-urlencode "MessageSid=SMtest$(date +%s%N | head -c 16)" \
    --data-urlencode "AccountSid=ACtest123")

  if [[ -z "$raw" ]]; then
    printf '\033[1;31m[no response — is the dev server running?]\033[0m\n'
    return
  fi

  reply=$(echo "$raw" | extract_message)
  printf '\033[1;32m<<< NORA:\033[0m %s\n' "${reply:-[empty TwiML — check server logs]}"
}

# ── Health check ──────────────────────────────────────────────────────────────

if ! curl -sf --max-time 3 "http://localhost:3000" > /dev/null 2>&1; then
  echo ""
  echo "  Error: Dev server not reachable at http://localhost:3000"
  echo "  Run: cd nora-agent && npm run dev"
  echo ""
  exit 1
fi

echo ""
echo "  Nora SMS Simulation"
echo "  Endpoint : $BASE_URL"
echo "  Caller   : $FROM"
echo ""

# ── Interactive mode ──────────────────────────────────────────────────────────

if [[ "${1:-}" == "-i" || "${1:-}" == "--interactive" ]]; then
  echo "  Interactive mode. Type each message and press Enter. Ctrl+C to quit."
  echo "  (Conversation history is kept server-side per phone number.)"
  echo ""
  while true; do
    printf '\033[1;34m>>> YOU:\033[0m '
    read -r user_input
    [[ -z "$user_input" ]] && continue
    send "$user_input"
  done
fi

# ── Scripted happy-path test ──────────────────────────────────────────────────

echo "  Running scripted happy-path booking conversation..."
echo "  (Each curl call waits for a full response — Claude API adds natural delay.)"
echo "  ─────────────────────────────────────────────────────────────────────────"

send "Hi, I need a plumber"
send "My kitchen faucet has been dripping non-stop"
send "It's not an emergency, whenever you have time this week is fine"
send "My name is Alex Rivera"
send "alex.rivera@example.com"
send "4521 Larimer St, Denver CO 80216"
send "1"   # Pick first available slot

echo ""
echo "  ─────────────────────────────────────────────────────────────────────────"
echo "  Done. Things to verify:"
echo "    ✓ Each reply was short and SMS-appropriate (no markdown)"
echo "    ✓ Nora collected name, email, address before showing slots"
echo "    ✓ Booking confirmation message appeared after '1'"
echo "    ✓ Contractor notification email arrived (check CONTRACTOR_EMAIL or 13dmh33@gmail.com)"
echo ""
