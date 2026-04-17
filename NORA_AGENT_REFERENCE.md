# Nora Agent — Master Build Reference

Astrova Advisors  •  Trade Scale Systems

_Last Updated: April 15, 2026_

---

## 1. Project Overview

Nora is a custom AI chat agent built for plumbing and HVAC contractors under the Astrova Advisors brand. The agent runs 24/7 on contractor websites, captures leads, identifies emergencies, and books appointments automatically.

| Item | Detail |
|---|---|
| Product | Nora — AI chat agent for plumbing/HVAC contractors |
| Brand | Astrova Advisors ("AI agents built for the trades") |
| Owner | Dave — sole proprietor, side hustle |
| Repo | github.com/13dmh33/Nora-Agent |
| Live URL | nora-agent-3ie8lnb4j-13dmh33-4012s-projects.vercel.app |
| Email | tradescalesolutions2026@gmail.com |
| Calendly | calendly.com/tradescalesolutions2026 |

---

## 2. The Stack

Every component is free until you have a paying customer.

| Tool | What It Does | Cost |
|---|---|---|
| GitHub Codespaces | Browser-based dev environment. No local installs needed. | Free tier |
| Next.js | App framework — frontend (UI) and backend (API routes). | Free / open source |
| Anthropic SDK | Connects app to Claude AI (Nora's brain). | $5 free credit to start |
| Resend | Email notifications to contractor when a lead is captured. | Free tier (100 emails/day) |
| Vercel | Hosts the app live on the internet. | Free tier |
| .env.local | Stores API keys securely. Never committed to GitHub. | N/A |

---

## 3. Build Schedule

| Phase | Dates | Goal | Status |
|---|---|---|---|
| P1 Core Agent | Apr 14-18 | Nora live, lead capture, deployed to Vercel | Complete |
| P2 Chat Widget | Apr 21-25 | Embeddable bubble for contractor websites | Complete |
| P3 Integrations | Apr 28-May 9 | Calendly, Google Calendar, lead notifications | In Progress |
| P4 Packaging | May 12-16 | Client onboarding, pricing page, domain setup | Upcoming |
| P5 Test + Launch | May 19-23 | Land Customer 1 | Upcoming |

---

## 4. File Structure

| File / Folder | Purpose |
|---|---|
| nora-agent/app/api/chat/route.ts | Nora's brain — backend, Anthropic API, lead save, email notification |
| nora-agent/app/page.tsx | Floating widget UI — frontend chat interface |
| nora-agent/public/widget.js | Embeddable script for contractor sites (2-line install) |
| nora-agent/public/demo.html | Sales demo page (fake plumber site, Nora widget embedded) |
| nora-agent/leads.json | Lead storage — flat file (not committed to GitHub) |
| nora-agent/.env.local | API keys — ANTHROPIC_API_KEY and RESEND_API_KEY (never commit) |

---

## 5. Key Terminal Commands

Run these every session in order:

| Step | Command | Purpose |
|---|---|---|
| 1 | cd /workspaces/Nora-Agent/nora-agent | Navigate to app root |
| 2 | npx next dev | Start dev server |
| 3 | cat leads.json | View captured leads |
| 4 | cat .env.local | Verify API keys |
| 5 | pkill -f 'next dev' | Kill stuck dev server |
| 6 | cd /workspaces/Nora-Agent && git add . && git commit -m 'msg' && git push | Save to GitHub |

---

## 6. Environment Variables

Two keys required in `nora-agent/.env.local`:

| Variable | Where to Get It | Notes |
|---|---|---|
| ANTHROPIC_API_KEY | console.anthropic.com/settings/keys | Rotate immediately if accidentally committed |
| RESEND_API_KEY | resend.com → API Keys | Also add to Vercel Environment Variables for production |

---

## 7. What's Built — P1 + P2 + P3 Progress

### route.ts — Nora's Brain
- Receives full conversation history from frontend
- Sends to Claude API with plumbing-specific system prompt
- Detects `<<LEAD>>` signal in response
- Parses and saves lead to leads.json
- Sends email notification via Resend to contractor inbox
- Strips signal before returning response to customer

### page.tsx — Floating Widget UI
- Floating blue bubble (bottom-right, #2E5B8A)
- Click to open/close chat window
- Full conversation history sent to API each message
- Uses inline styles — no Tailwind dependency for portability

### widget.js — Embeddable Script
- Vanilla JS, no dependencies, IIFE pattern
- Contractor pastes 2 lines into any website HTML
- Creates bubble + chat window via DOM manipulation
- Calls Nora's API at `NORA_URL/api/chat`

### demo.html — Sales Demo
- Fake plumber website (Mike's Plumbing, Denver)
- Nora widget embedded — shows prospects exactly what customers see
- Self-contained — uses relative `/api/chat` URL, works on any deployment

### Email Notifications (P3 — In Progress)
- Resend installed and wired into route.ts
- RESEND_API_KEY added to .env.local and Vercel environment variables
- Email fires on lead capture — sends name, phone, email, address, issue, timestamp
- Lead saves to leads.json confirmed working
- Email delivery to inbox: debugging in progress (Resend domain verification needed)

---

## 8. Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| npm error ENOENT package.json | Wrong folder | cd /workspaces/Nora-Agent/nora-agent |
| Port 3000 in use | Old server running | pkill -f 'next dev' then npx next dev |
| bash: import: command not found | Code pasted into terminal | Open file in editor, paste there |
| 401 Unauthorized on widget | Codespaces port not public | Ports tab → right-click port 3000 → Make Public |
| ETIMEDOUT on API call | Codespaces network restriction | Push to GitHub, test on Vercel instead |
| GitHub push blocked (secret scanning) | API key in commit | git reset HEAD~1, add to .gitignore, recommit |
| Cannot find module @types/node | Missing type definitions | npm i --save-dev @types/node |

---

## 9. P3 Remaining Roadmap

| Task | Priority | Notes |
|---|---|---|
| Fix email delivery (Resend domain verification) | High | Check Resend dashboard → Emails for error. May need domain or verified address. |
| Persistent lead storage | High | Replace leads.json with Supabase or Google Sheets — resets on Vercel deploy |
| Calendly per-contractor dynamic link | Medium | Each client gets their own Calendly URL in system prompt |
| SMS notifications via Twilio | Medium | Contractor gets text when lead captured |
| Google Calendar sync | Medium | Deeper than Calendly link — actual calendar write |

---

## 10. Critical Patterns

### Never paste code into the terminal
Always open the file in the editor, paste there, save. If code accidentally goes to terminal, ignore the errors — no damage done.

### File editing workflow
Open file from sidebar → Ctrl+A to select all → paste code → Ctrl+S to save.

### Saving to GitHub
Always from `/workspaces/Nora-Agent` (one level up from nora-agent):
```bash
cd /workspaces/Nora-Agent && git add . && git commit -m 'description' && git push
```

### API key safety
- Stored in `nora-agent/.env.local`
- Listed in `.gitignore` — never commits
- If accidentally committed: rotate immediately at console.anthropic.com/settings/keys
- On Vercel: set as Environment Variable in project settings

---

_Astrova Advisors — AI agents built for the trades._
