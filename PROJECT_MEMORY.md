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
| Calendly | https://calendly.com/13dmh33/discovery-call |

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
| P3 Integrations | Apr 28–May 9 | SMS channel, Twilio, lead notifications | 🔄 In Progress |
| P4 Packaging | May 12–16 | Client onboarding docs, pricing page, domain | Upcoming |
| P5 Test + Launch | May 19–23 | Land Customer 1 | Upcoming |

---

## Tech Stack

| Tool | Role | Cost |
|---|---|---|
| Next.js 16.2.3 | App framework (App Router) | Free |
| Anthropic Claude API | Nora's brain (`claude-sonnet-4-20250514`) | Pay per token |
| Resend | Email notifications to contractor | Free tier (100/day) |
| Twilio | SMS channel — inbound/outbound | ~$1/mo + per message |
| Vercel | Hosting | Free tier |
| GitHub | Source control | Free |

---

## Environment Variables

Stored in `nora-agent/.env.local` — never commit. Must also be set in Vercel project settings.

```
ANTHROPIC_API_KEY=          # console.anthropic.com/settings/keys
RESEND_API_KEY=             # resend.com → API Keys
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
| `nora-agent/app/api/chat/route.ts` | Web chat backend — Claude API, lead capture, Resend email |
| `nora-agent/app/api/sms/route.ts` | Twilio SMS webhook — existing customer routing, AI for new customers |
| `nora-agent/app/page.tsx` | Web chat UI (React client component, Tailwind) |
| `nora-agent/public/widget.js` | Embeddable chat bubble (vanilla JS, no deps) |
| `nora-agent/public/demo.html` | Standalone demo — fake Mike's Plumbing site with widget |
| `nora-agent/customers.json` | Existing customer list — phone numbers in E.164 format |
| `nora-agent/leads.json` | Captured leads — ephemeral on Vercel, resets on deploy |

---

## Lead Capture Pattern

Both `/api/chat` and `/api/sms` use the same pattern:

Claude is instructed to emit a `<<LEAD>>...<<END>>` block when all 5 fields are collected: name, phone, email, address, issue. The backend parses this with regex, saves to `leads.json`, notifies the contractor, then strips the block before returning the clean message to the user.

---

## SMS Channel — How It Works

- Contractor gets a Twilio phone number
- Customer texts it → Twilio POSTs to `/api/sms`
- **Existing customer** (phone in `customers.json`): Nora replies with handoff message, contractor is notified via email + SMS
- **New customer**: Nora handles via Claude AI, same lead capture flow
- Conversation history stored in-memory per phone number (resets on server restart — acceptable for MVP)
- To add existing customers: edit `customers.json`, add `{ "name": "", "phone": "+1...", "email": "", "addedAt": "" }`
- Twilio webhook URL: `https://<vercel-url>/api/sms`

---

## Pricing Model

| Plan | Setup | Monthly |
|---|---|---|
| Starter | $297 | $97/mo |
| Growth | $497 | $147/mo |
| Pro | $797 | $197/mo |

Twilio cost (~$1/mo + fractions per message) is built into pricing.

---

## Known Constraints

- `leads.json` and `customers.json` reset on every Vercel deployment — ephemeral. Persistent storage (Supabase or Google Sheets) is a P3/P4 item.
- Resend free tier requires domain verification for reliable delivery. Currently using `onboarding@resend.dev` as sender.
- SMS conversation memory is in-memory only — lost on server restart. Fine for MVP since most conversations complete in one session.
- The Claude GitHub App currently only has read access to this repo — write access needs to be granted at github.com/settings/installations.

---

## P3 Remaining Work

| Task | Priority |
|---|---|
| Fix Resend email delivery (domain verification) | High |
| Persistent lead + customer storage (Supabase / Google Sheets) | High |
| Twilio setup + test SMS end-to-end | High |
| Calendly per-contractor dynamic link | Medium |
| SMS notifications via Twilio to contractor | Medium (env vars wired, needs testing) |

---

## Per-Client Deployment Checklist

When onboarding a new client:
- [ ] Fork/copy this repo
- [ ] Update system prompt in `app/api/chat/route.ts` and `app/api/sms/route.ts` (contractor name, services, Calendly link)
- [ ] Set `CONTRACTOR_EMAIL` env var
- [ ] Set all `TWILIO_*` env vars
- [ ] Deploy new Vercel project
- [ ] Point client's Twilio number webhook → `https://<new-vercel-url>/api/sms`
- [ ] Share `customers.json` edit access so contractor can add existing customers

---

*Last updated: April 21, 2026*
