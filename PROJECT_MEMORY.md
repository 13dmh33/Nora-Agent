# PROJECT_MEMORY.md
> Living reference for the Nora-Agent project. Update this file as decisions are made, configs change, or new features are added.

---

## Identity

| Field | Value |
|---|---|
| Product | Nora — AI chat + SMS agent for trades contractors |
| Company | Trade Scale Systems (sole prop) |
| Brand | Astrova Advisors — "AI agents built for the trades" |
| Owner | Dave (13dmh33) |
| Repo | github.com/13dmh33/Nora-Agent |
| Live URL | nora-agent-git-main-13dmh33-4012s-projects.vercel.app |
| Notification email | 13dmh33@gmail.com |
| Cal.com | cal.com/david-hettinger-g8qbdk/30min |

---

## What This Is

A demo/template Next.js app that powers Nora, an AI agent for plumbing contractors. When a contractor signs up, this repo is copied, the system prompt and contact details are updated, and a new Vercel project is deployed for that client.

The demo uses a fake plumber site (Mike's Plumbing, Denver) to show prospects exactly what their customers would experience.

---

## Current Build Status

| Phase | Dates | Goal | Status |
|---|---|---|---|
| P1 Core Agent | Apr 14–18 | Nora live, lead capture, Vercel deploy | ✅ Complete |
| P2 Chat Widget | Apr 21–25 | Embeddable bubble for contractor websites | ✅ Complete |
| P3 Integrations | Apr 21–May 9 | SMS channel, Cal.com scheduling, notifications | 🔄 In Progress |
| P4 Packaging | May 12–16 | Client onboarding docs, pricing page, domain | Upcoming |
| P5 Test + Launch | May 19–23 | Land Customer 1 | Upcoming |

**P3 progress as of Apr 23, 2026 (session 2):**
- ✅ Claude tool use refactor — `chat/route.ts` fully rebuilt, no more regex pattern
- ✅ Cal.com integration — `get_available_slots` + `create_booking` tools live
- ✅ Cal.com v1 → v2 migration — Cal.com decommissioned v1; fully migrated to v2 API (Bearer auth, new endpoints, new response shapes)
- ✅ End-to-end Cal.com booking test — **confirmed working** (real slots presented, appointment booked, contractor email sent)
- ✅ SMS channel — `/api/sms` endpoint, existing customer routing, Twilio webhook
- ✅ `customers.json` — existing customer list for SMS routing
- ✅ Contractor notifications — email always, SMS when TWILIO_* vars set
- ✅ `RESEND_API_KEY` fixed in Vercel — now covers Production environment

**P3 progress as of Apr 27, 2026 (session 3):**
- ✅ SMS route upgraded to tool use + Cal.com — `sms/route.ts` now matches `chat/route.ts` architecture
- ✅ SMS curl test confirmed — Claude → Cal.com slots → TwiML response working end-to-end on Vercel
- ✅ Fixed `notifyContractor` crash when `RESEND_API_KEY` missing (graceful warn + skip)
- ✅ Fixed `Twilio_Phone_NUmber` typo — code now reads both spellings as fallback
- ✅ Vercel deployment protection disabled — endpoint publicly accessible for Twilio webhooks
- ✅ Twilio webhook URL updated to new production URL (`nora-agent-git-main-...`)
- ⏳ Twilio live SMS test — **blocked: trial account cannot send outbound US SMS** (needs paid upgrade + A2P 10DLC registration)
- ⏳ Resend domain verification — pending (emails sending but from onboarding@resend.dev)
- ⏳ Persistent lead/customer storage — pending (leads.json resets on deploy)

---

## Tech Stack

| Tool | Role | Cost |
|---|---|---|
| Next.js 16.2.3 | App framework (App Router) | Free |
| Anthropic Claude API | Nora's brain — `claude-sonnet-4-20250514` with tool use | Pay per token |
| Cal.com | Calendar availability + direct booking (replaced Calendly) | Free tier |
| Resend | Email notifications to contractor | Free tier (100/day) |
| Twilio | SMS channel — inbound/outbound | ~$1/mo + per message |
| Vercel | Hosting | Free tier |
| GitHub | Source control | Free |
| Claude Code | Dev environment (claude.ai/code) | Subscription |

---

## Environment Variables

Stored in `nora-agent/.env.local` — never commit. Must also be set in Vercel project settings.

```
ANTHROPIC_API_KEY=          # console.anthropic.com/settings/keys ✅ Vercel
RESEND_API_KEY=             # resend.com → API Keys ✅ Vercel (Production + Preview)
Cal_API=                    # cal.com/settings/developer/api-keys ✅ Vercel (note: named Cal_API not CAL_API_KEY)
CONTRACTOR_EMAIL=           # where leads/alerts go (defaults to 13dmh33@gmail.com)

# Twilio — all 4 required to enable SMS notifications to contractor
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=          # Twilio number in E.164 (+1xxxxxxxxxx)
TWILIO_CONTRACTOR_PHONE=    # contractor's cell in E.164 (+1xxxxxxxxxx)
```

---

## Key Files

| File | What It Does |
|---|---|
| `nora-agent/app/api/chat/route.ts` | Web chat — Claude tool use, Cal.com booking, Resend email |
| `nora-agent/app/api/sms/route.ts` | SMS webhook — existing customer routing, AI for new customers |
| `nora-agent/app/page.tsx` | Web chat UI (React, Tailwind) |
| `nora-agent/public/widget.js` | Embeddable chat bubble (vanilla JS) |
| `nora-agent/public/demo.html` | Standalone Mike's Plumbing demo site |
| `nora-agent/customers.json` | Existing customer list — E.164 phone numbers |
| `nora-agent/leads.json` | Captured leads — ephemeral on Vercel |
| `CLAUDE.md` | Claude Code session guidance |
| `NORA_AGENT_REFERENCE.md` | Full project reference (mirrors Google Doc) |

---

## Architecture Decision Log

| Date | Decision | Reason |
|---|---|---|
| Apr 21 | Switched Calendly → Cal.com | Calendly API cannot book on behalf of customer. Cal.com has `POST /bookings`. |
| Apr 21 | Refactored to Claude tool use | Regex `<<LEAD>>` pattern is fragile at scale. Tool use is the right architecture. |
| Apr 21 | Added SMS channel | Most small contractors use cell phones more than websites. |
| Apr 21 | Separate `customers.json` | Existing customers need human handoff, not AI. Separate list keeps routing clean. |
| Apr 21 | Development moved to Claude Code | Using claude.ai/code as primary dev environment going forward. |
| Apr 23 | Migrated Cal.com v1 → v2 | Cal.com decommissioned v1 API entirely. v2 uses Bearer auth, `/v2/slots`, `/v2/bookings`, `start`/`end` params, `slot.start` field. |
| Apr 23 | Vercel env var named `Cal_API` | Variable was created as `Cal_API` not `CAL_API_KEY`. Code reads both via `process.env.Cal_API \|\| process.env.CAL_API_KEY`. |

---

## Pricing Model

| Plan | Setup | Monthly |
|---|---|---|
| Starter | $297 | $97/mo |
| Growth | $497 | $147/mo |
| Pro | $797 | $197/mo |

Twilio cost (~$1/mo + fractions per message) and Cal.com (free tier) built into pricing.

---

## Known Constraints & Risks

| Item | Risk | Plan |
|---|---|---|
| `leads.json` ephemeral | Lost on every Vercel deploy | Supabase or Google Sheets — P4 |
| `customers.json` ephemeral | Same as above | Same fix |
| Resend domain unverified | Email delivery unreliable | Verify domain before Customer 1 |
| SMS conversation memory in-memory | Lost on restart | Acceptable for MVP |
| ~~No Twilio signature validation~~ | ~~Webhook security gap~~ | ✅ Fixed Apr 27 |
| Twilio trial account | Outbound US SMS blocked | Upgrade account + A2P 10DLC registration (1–2 week approval) |

---

## Action Items (prioritized)

| Priority | Item | Notes |
|---|---|---|
| 🔴 High | Upgrade Twilio trial → paid | Unblocks live SMS test + A2P registration. ~$20 top-up at console.twilio.com |
| 🔴 High | A2P 10DLC registration | Required for US outbound SMS. Start ASAP — takes 1–2 weeks to approve |
| 🟡 Medium | Resend domain verification | Emails work but come from onboarding@resend.dev — fix before Customer 1 |
| 🟡 Medium | Service area gating (zip code) | Scoped Apr 30 — see Planned Features below. Est. 45 min. |
| 🟡 Medium | Google Sheets lead storage (CRM bridge) | Scoped Apr 30 — see Planned Features below. Est. 1.5 hrs. |
| 🟢 Low | Run prospecting workflow | Google Places scraper ready — run on target markets to fill drip pipeline |
| ✅ Done | Set `Twilio_Phone_NUmber=+17209027555` in Vercel | Completed Apr 27 |
| ✅ Done | Twilio webhook signature validation | Completed Apr 27 — skips gracefully in local dev |

---

## Planned Features (Scoped, Not Yet Built)

### Feature 1: Service Area Gating by Zip Code
**Goal:** Block scheduling if customer is outside the contractor's service area.  
**Estimated effort:** ~45 minutes  
**Status:** Scoped Apr 30 — ready to implement

**Decisions:**
- Out-of-area leads are **dropped entirely** — no save, no email
- Zip extracted via **hybrid approach**: regex parse from address first; Nora asks explicitly only if no zip found
- Service area defined in `service-area.json` (repo root) — simple array of allowed zip codes, editable per client

**What gets built:**
- `service-area.json` — array of covered zip codes (e.g. `["80501", "80503", ...]`)
- New Claude tool `check_service_area(zip)` → `{ covered: boolean }` in both `chat/route.ts` and `sms/route.ts`
- System prompt update in both routes: call `check_service_area` before `get_available_slots`; if not covered, apologize and end — save nothing
- No new env vars needed

**Flow:**
```
Address collected
  → regex extract zip from string
  → if no zip found → Nora asks "What's your zip code?"
  → check_service_area(zip)
    → covered: true  → continue to get_available_slots
    → covered: false → apologize, end conversation, save nothing
```

---

### Feature 2: Google Sheets Lead Storage (CRM Bridge)
**Goal:** Persist leads to Google Sheets instead of ephemeral `leads.json`. Architected so swapping to a real CRM later is a one-file change.  
**Estimated effort:** ~1.5 hours (+ ~20 min Google Cloud setup on your end)  
**Status:** Scoped Apr 30 — ready to implement

**Decisions:**
- One sheet for all clients — `client` column distinguishes deployments
- `leads.json` kept as silent fallback if Google Sheets write fails
- `lib/crm.ts` is the abstraction point — future CRM (HubSpot, Salesforce) replaces only this file

**What gets built:**
- `nora-agent/lib/crm.ts` — exports `saveLead(lead)`. Appends row to Google Sheet; falls back to `leads.json` on failure; never throws
- Both `route.ts` files — replace inline `saveLead()` with `import { saveLead } from "@/lib/crm"`
- `googleapis` npm package added as dependency

**Sheet columns:** `timestamp`, `client`, `source` (web/sms), `name`, `phone`, `email`, `address`, `issue`, `booking_id`, `booking_time`

**New env vars (per deployment):**
```
GOOGLE_SERVICE_ACCOUNT_JSON=   # full service account JSON (base64 or inline)
GOOGLE_SHEET_ID=               # from the Google Sheet URL
CLIENT_NAME=                   # written to "client" column (e.g. "Mikes Plumbing")
```

**Google Cloud setup (one-time, done by you):**
1. Create a service account in Google Cloud Console
2. Download the JSON key
3. Share the Google Sheet with the service account email (editor access)
4. Add the three env vars above to `.env.local` and Vercel

**`crm.ts` behavior:**
```
saveLead(lead)
  → append row to Google Sheet (with client column)
  → if Sheet write fails → fall back to leads.json
  → never throws — always non-fatal
```

---

## Dev Branch

Active development branch: `claude/plan-daily-tasks-amNtn`
Merged to main: April 27, 2026 (session 3)

---

## Per-Client Deployment Checklist

When onboarding a new client:
- [ ] Fork/copy this repo
- [ ] Update system prompt in `chat/route.ts` and `sms/route.ts`
- [ ] Set `CONTRACTOR_EMAIL`, `Cal_API`, all `TWILIO_*` env vars in Vercel (note: Cal.com key var is `Cal_API`)
- [ ] Verify Cal.com event type slug matches code (`30min`)
- [ ] Deploy new Vercel project
- [ ] Point Twilio number webhook → `https://<vercel-url>/api/sms`
- [ ] Add existing customers to `customers.json` (E.164 format)

---

*Last updated: April 30, 2026 (session 5)*
