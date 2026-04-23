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
| Live URL | nora-agent-3ie8lnb4j-13dmh33-4012s-projects.vercel.app |
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
- ⏳ Twilio end-to-end SMS test — pending
- ⏳ Resend domain verification — pending (emails sending but from onboarding@resend.dev)
- ⏳ Persistent lead/customer storage — pending (leads.json resets on deploy)
- ⏳ SMS route upgrade to tool use + Cal.com — next session

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
| No Twilio signature validation | Webhook security gap | Fix before production |
| SMS route still uses regex | Less reliable than tool use | Upgrade next session |

---

## Dev Branch

Active development branch: `claude/resume-session-0t22o`
Merged to main: April 23, 2026 (session 2)

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

*Last updated: April 23, 2026 (session 2)*
