# Nora Agent — Master Build Reference

Astrova Advisors  •  Trade Scale Systems

_Last Updated: April 23, 2026_

---

## 1. Project Overview

Nora is a custom AI chat agent built for plumbing and HVAC contractors under the Astrova Advisors brand. The agent runs 24/7 on contractor websites and via SMS, captures leads, identifies emergencies, proposes available appointment times, and books directly — no external links needed.

| Item | Detail |
|---|---|
| Product | Nora — AI chat + SMS agent for plumbing/HVAC contractors |
| Brand | Astrova Advisors ("AI agents built for the trades") |
| Owner | Dave — sole proprietor |
| Repo | github.com/13dmh33/Nora-Agent |
| Live URL | nora-agent-3ie8lnb4j-13dmh33-4012s-projects.vercel.app |
| Notification email | 13dmh33@gmail.com |
| Cal.com | cal.com/david-hettinger-g8qbdk/30min |

---

## 2. The Stack

| Tool | What It Does | Cost |
|---|---|---|
| Next.js 16.2.3 | App framework — frontend (UI) and backend (API routes) | Free / open source |
| Anthropic Claude API | Nora's brain — `claude-sonnet-4-20250514` with tool use | Pay per token |
| Cal.com | Calendar availability + direct booking API (replaces Calendly) | Free tier |
| Resend | Email notifications to contractor on booking/lead | Free tier (100/day) |
| Twilio | SMS channel — inbound customer texts + outbound contractor alerts | ~$1/mo + per message |
| Vercel | Hosts the app live on the internet | Free tier |
| GitHub | Source control | Free |
| Claude Code | Development environment (claude.ai/code) | Subscription |

---

## 3. Build Schedule

| Phase | Dates | Goal | Status |
|---|---|---|---|
| P1 Core Agent | Apr 14–18 | Nora live, lead capture, deployed to Vercel | ✅ Complete |
| P2 Chat Widget | Apr 21–25 | Embeddable bubble for contractor websites | ✅ Complete |
| P3 Integrations | Apr 21–May 9 | SMS channel, Cal.com scheduling, notifications | 🔄 In Progress |
| P4 Packaging | May 12–16 | Client onboarding docs, pricing page, domain | Upcoming |
| P5 Test + Launch | May 19–23 | Land Customer 1 | Upcoming |

---

## 4. File Structure

| File / Folder | Purpose |
|---|---|
| `nora-agent/app/api/chat/route.ts` | Web chat backend — Claude tool use, Cal.com booking, Resend email |
| `nora-agent/app/api/sms/route.ts` | Twilio SMS webhook — existing customer routing, AI for new customers |
| `nora-agent/app/page.tsx` | Web chat UI — React client component, Tailwind |
| `nora-agent/public/widget.js` | Embeddable chat bubble — vanilla JS, no dependencies |
| `nora-agent/public/demo.html` | Sales demo — fake Mike's Plumbing site with Nora widget |
| `nora-agent/customers.json` | Existing customer list — E.164 phone numbers for SMS routing |
| `nora-agent/leads.json` | Captured leads — ephemeral on Vercel, resets on deploy |
| `nora-agent/.env.local` | API keys — never committed |
| `CLAUDE.md` | Guidance file for Claude Code sessions |
| `PROJECT_MEMORY.md` | Living project reference — decisions, status, constraints |

---

## 5. Environment Variables

All stored in `nora-agent/.env.local` and Vercel project settings. Never commit.

| Variable | Where to Get It | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | Yes |
| `RESEND_API_KEY` | resend.com → API Keys | Yes |
| `CAL_API_KEY` | cal.com/settings/developer/api-keys | Yes |
| `CONTRACTOR_EMAIL` | Set to contractor's email | Yes |
| `TWILIO_ACCOUNT_SID` | twilio.com console | SMS only |
| `TWILIO_AUTH_TOKEN` | twilio.com console | SMS only |
| `TWILIO_FROM_PHONE` | Twilio number in E.164 format | SMS only |
| `TWILIO_CONTRACTOR_PHONE` | Contractor cell in E.164 format | SMS only |

---

## 6. Key Terminal Commands

All commands from `nora-agent/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

Test manually at `localhost:3000` (chat UI) or `localhost:3000/demo.html` (widget demo). No test suite configured.

---

## 7. What's Built

### route.ts — Web Chat Backend (Claude Tool Use)

Rebuilt in April 2026 from a regex-based pattern to Claude's native tool use API.

**Tools Nora can call:**
- `get_available_slots(urgency)` — fetches real open times from Cal.com. Emergency = next 6 hours. Routine = next 4 days.
- `create_booking(start_time, name, phone, email, address, issue)` — books directly via Cal.com API. No link sent to customer.

**Flow:**
1. Nora collects: issue type, urgency, name, phone, email, address
2. Calls `get_available_slots` → presents 2–3 real times to customer
3. Customer picks → Nora calls `get_available_slots` again for fresh ISO timestamp → calls `create_booking`
4. Cal.com confirms → Resend emails contractor → Nora confirms to customer

Cal.com event type looked up at runtime by slug (`30min`), cached in memory.

### sms/route.ts — SMS Channel (Twilio)

Handles inbound customer texts via Twilio webhook.

- **Existing customers** (phone in `customers.json`): Nora replies with handoff message, contractor notified via email + SMS
- **New customers**: Same Nora AI flow, `<<LEAD>>` capture pattern (SMS route not yet upgraded to tool use)
- Conversation history stored in-memory per phone number
- Returns TwiML XML to Twilio

Twilio webhook URL: `https://<vercel-url>/api/sms`

### widget.js — Embeddable Script

- Vanilla JS IIFE — contractor pastes 2 lines into any website
- `window.NORA_URL` sets the API endpoint (defaults to relative, set to Vercel URL for external sites)
- Creates floating bubble + chat window via DOM manipulation

### demo.html — Sales Demo

- Fake plumber website (Mike's Plumbing, Denver)
- Nora widget embedded — shows prospects what their customers would experience
- Uses relative `/api/chat` — works on any deployment automatically

### Email Notifications

- Fires on every booking and lead capture
- Sends: name, phone, email, address, issue, appointment time, Cal.com booking ID
- From: `onboarding@resend.dev` (needs domain verification for production reliability)

---

## 8. Architecture Decision Log

| Date | Decision | Reason |
|---|---|---|
| Apr 21 | Switched Calendly → Cal.com | Calendly API cannot book on behalf of customer. Cal.com has direct `POST /bookings` endpoint. |
| Apr 21 | Refactored to Claude tool use | Regex `<<LEAD>>` pattern is fragile. Tool use is purpose-built for structured AI actions. |
| Apr 21 | Added SMS channel via Twilio | Most small contractors use cell phones, not websites. SMS reach is broader. |
| Apr 21 | Separate `customers.json` | Existing customers need different routing (human handoff) vs. new leads (AI flow). |

---

## 9. Per-Client Deployment Checklist

When onboarding a new client:
- [ ] Fork/copy this repo
- [ ] Update system prompt in `chat/route.ts` and `sms/route.ts` (contractor name, services, tone)
- [ ] Set `CONTRACTOR_EMAIL` env var
- [ ] Set `CAL_API_KEY` and verify event type slug matches (`30min` or custom)
- [ ] Set all `TWILIO_*` env vars
- [ ] Deploy new Vercel project
- [ ] Point client's Twilio number webhook → `https://<vercel-url>/api/sms`
- [ ] Add existing customers to `customers.json` (E.164 format)

---

## 10. Known Constraints & Outstanding Work

| Item | Status | Notes |
|---|---|---|
| Resend domain verification | Pending | Using `onboarding@resend.dev` — delivery unreliable without verified domain |
| Persistent lead storage | Pending | `leads.json` resets on every Vercel deploy — Supabase or Google Sheets needed |
| Twilio end-to-end SMS test | Pending | Code built, env vars needed in Vercel |
| SMS route tool use upgrade | Pending | SMS still uses `<<LEAD>>` regex — upgrade to tool use + Cal.com booking in next session |
| Twilio signature validation | Pending | No webhook auth yet — security gap before production |
| SMS conversation memory | In-memory only | Resets on server restart — acceptable for MVP |

---

## 11. Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `npm error ENOENT package.json` | Wrong folder | `cd nora-agent/` |
| Port 3000 in use | Old server running | `pkill -f 'next dev'` then restart |
| Cal.com event type not found | Slug mismatch | Verify slug matches exactly in `getEventTypeId()` — currently `30min` |
| Nora still sends Calendly link | Old code on main | Merge feature branch → main, redeploy Vercel |
| GitHub push blocked (secret scanning) | API key in commit | `git reset HEAD~1`, add to `.gitignore`, recommit |

---

_Astrova Advisors — AI agents built for the trades._
