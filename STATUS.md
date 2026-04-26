# Nora Agent — Project Status
**Astrova Advisors · Trade Scale Systems**
Last Updated: April 26, 2026

---

## 1. Project Overview

Nora is a custom AI chat agent for plumbing and HVAC contractors. It runs 24/7 on contractor websites, captures leads, identifies emergencies, and books appointments automatically — no human dispatcher needed.

| Item | Detail |
|---|---|
| Product | Nora — AI scheduling agent for plumbing/HVAC contractors |
| Brand | Astrova Advisors ("AI agents built for the trades") |
| Owner | Dave — sole proprietor, side hustle |
| Repo | github.com/13dmh33/Nora-Agent |
| Live URL | nora-agent-3ie8lnb4j-13dmh33-4012s-projects.vercel.app |
| Email | tradescalesolutions2026@gmail.com |

---

## 2. The Stack

| Tool | What It Does | Cost |
|---|---|---|
| GitHub Codespaces | Browser-based dev environment | Free tier |
| Next.js 16 (App Router) | Framework — frontend UI + backend API routes | Free / open source |
| Anthropic SDK | Claude AI — Nora's brain, tool use agentic loop | Pay per token |
| Cal.com v2 API | Live appointment booking (replaced Calendly) | Free tier |
| Resend | Email notifications to contractor on lead/booking | Free tier (100/day) |
| Twilio | SMS channel — inbound texts routed through Nora | Pay per SMS |
| Vercel | Production hosting | Free tier |

---

## 3. Build Schedule

| Phase | Dates | Goal | Status |
|---|---|---|---|
| P1 Core Agent | Apr 14–18 | Nora live, lead capture, deployed to Vercel | ✅ Complete |
| P2 Chat Widget | Apr 21 | Embeddable bubble for contractor websites | ✅ Complete |
| P3 Integrations | Apr 21–26 | SMS, Cal.com booking, contractor notifications | ✅ Complete |
| P4 Packaging | May 12–16 | Client onboarding, pricing page, domain setup | 🔜 Upcoming |
| P5 Test + Launch | May 19–23 | Land Customer 1 | 🔜 Upcoming |

---

## 4. File Structure

| File / Folder | Purpose |
|---|---|
| `nora-agent/app/api/chat/route.ts` | Web chat backend — agentic loop, Cal.com booking, lead save, email |
| `nora-agent/app/api/sms/route.ts` | Twilio SMS webhook — existing customer routing, same agentic loop as web |
| `nora-agent/app/page.tsx` | Floating chat UI — React client component |
| `nora-agent/public/widget.js` | Embeddable script for contractor sites (2-line install, no dependencies) |
| `nora-agent/public/demo.html` | Sales demo page — fake plumber site (Mike's Plumbing, Denver) |
| `nora-agent/leads.json` | Lead storage — flat file, ephemeral on Vercel (resets each deploy) |
| `nora-agent/customers.json` | Existing customer list — phone numbers in E.164, triggers human handoff |
| `nora-agent/.env.local` | API keys — never committed |
| `test/sms-test.sh` | Local SMS end-to-end test script (scripted + interactive modes) |

---

## 5. Environment Variables

All stored in `nora-agent/.env.local`. Also set in Vercel project settings for production.

| Variable | Where to Get It | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | Rotate immediately if accidentally committed |
| `RESEND_API_KEY` | resend.com → API Keys | Must also be in Vercel env vars |
| `CONTRACTOR_EMAIL` | — | Defaults to hardcoded address if unset |
| `Cal_API` | cal.com → Settings → API Keys | Vercel uses `Cal_API` (exact casing) |
| `CAL_EVENT_SLUG` | — | Optional, defaults to `30min` |
| `Twilio_SID` | twilio.com console | Exact Vercel var name — do not rename |
| `Twilio_Account_Authorization` | twilio.com console | Auth token |
| `Twilio_Phone_NUmber` | twilio.com console | Your Twilio number in E.164 format |
| `TWILIO_CONTRACTOR_PHONE` | — | Contractor's cell for SMS alerts, E.164 format |

> **Twilio var names are non-standard** — they were set in Vercel with unusual casing. The SMS route reads them exactly as shown above.

---

## 6. What's Built

### Web Chat (`/api/chat`)
- Receives full conversation history from the frontend
- Runs an agentic loop with Claude tool use (no regex parsing)
- Tools: `get_available_slots`, `create_booking` (both via Cal.com v2 API)
- On booking: saves lead to `leads.json`, sends email notification via Resend
- Returns clean text response to the chat UI

### SMS Channel (`/api/sms`)
- Twilio webhook endpoint (form-encoded POST)
- Checks `customers.json` — existing customers get a human handoff reply + contractor alert
- New customers go through the same agentic loop as web chat (tool use + Cal.com)
- Injects the verified Twilio `From` number as the customer phone — doesn't trust Claude's guess
- Per-phone conversation history stored in an in-memory Map (resets on server restart)
- Bug fixed Apr 26: first message history was never saved due to incorrect `conversations.has()` check

### Cal.com Booking
- Migrated from Calendly (can't book on behalf of users) → Cal.com
- Migrated from Cal.com v1 (decommissioned) → v2 API
- Flow: `get_available_slots` → present 3 options → customer picks → `get_available_slots` again for fresh timestamps → `create_booking`
- Booking confirmation email sent to both customer (via Cal.com) and contractor (via Resend)

### Embeddable Widget
- `public/widget.js` — self-contained IIFE, no framework dependencies
- Contractor installs with 2 lines of HTML
- Reads `window.NORA_URL` for the API endpoint (defaults to relative, works same-origin)
- `public/demo.html` — full fake plumber site for sales demos

### Contractor Notifications
- Email always fires on new booking (Resend)
- SMS fires on new booking if all four Twilio vars are set
- Existing customer inbound text also triggers both

---

## 7. Key Terminal Commands

```bash
# Start dev server
cd /workspaces/Nora-Agent/nora-agent && npm run dev

# Run SMS end-to-end test (scripted walkthrough)
cd /workspaces/Nora-Agent && ./test/sms-test.sh

# Run SMS test in interactive mode
./test/sms-test.sh -i

# Check captured leads
cat nora-agent/leads.json

# Kill stuck dev server
pkill -f 'next dev'

# Save to GitHub
cd /workspaces/Nora-Agent && git add . && git commit -m 'description' && git push
```

---

## 8. What's Next

### Remaining security / reliability gaps
| Task | Priority | Notes |
|---|---|---|
| Twilio webhook signature validation | High | Any HTTP client can currently POST fake SMS messages |
| Resend domain verification | High | Off `onboarding@resend.dev` so emails don't land in spam |
| Persistent lead storage | Medium | `leads.json` resets on every Vercel deploy — need Supabase or Google Sheets |

### P4 — Packaging (May 12–16)
- Client onboarding checklist (per-client deployment steps)
- Pricing page
- Custom domain setup

### P5 — Launch (May 19–23)
- Land Customer 1

---

## 9. Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `npm error ENOENT package.json` | Wrong folder | `cd /workspaces/Nora-Agent/nora-agent` |
| Port 3000 in use | Old server running | `pkill -f 'next dev'` then restart |
| `Module not found: Can't resolve 'twilio'` | Package not installed | `npm install twilio` |
| `401 Unauthorized` on widget | Codespaces port not public | Ports tab → right-click 3000 → Make Public |
| `ETIMEDOUT` on API call | Codespaces network restriction | Push to GitHub, test on Vercel instead |
| GitHub push blocked (secret scanning) | API key in commit | `git reset HEAD~1`, add to `.gitignore`, recommit |
| Cal.com "No slots" in local test | `Cal_API` not in `.env.local` | Add key or test on Vercel where it's configured |

---

## 10. Architecture — Lead Capture Flow

```
User message
  │
  ├─ Web: POST /api/chat  { messages: [...] }
  └─ SMS: POST /api/sms   (Twilio webhook, form-encoded)
           │
           ├─ SMS only: check customers.json
           │    └─ match → notify contractor + return handoff reply
           │
           └─ Agentic loop (Claude tool use)
                ├─ get_available_slots → Cal.com v2 /slots
                └─ create_booking     → Cal.com v2 /bookings
                                           │
                                           ├─ save to leads.json
                                           ├─ email contractor (Resend)
                                           └─ SMS contractor (Twilio, if configured)
```

---

*Astrova Advisors — AI agents built for the trades.*
