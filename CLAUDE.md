# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Next.js Version Warning

This project uses **Next.js 16.2.3** — a version with breaking changes from earlier releases. Before writing any Next.js-specific code, check `nora-agent/node_modules/next/dist/docs/` for current APIs. Do not assume conventions from older versions.

---

## Commands

All commands run from `nora-agent/`:

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

No test suite is configured. Verify behavior manually via the chat UI at `localhost:3000` or the demo at `localhost:3000/demo.html`.

---

## Architecture

This is a **Next.js App Router** project. The entire product is two surfaces:

### 1. Hosted chat app (`app/`)
- `app/api/chat/route.ts` — Web chat backend. Receives `{ messages }` (full conversation history), calls Claude API with a hardcoded plumbing system prompt, detects a `<<LEAD>>...<<END>>` block in the response, saves the lead to `leads.json`, sends an email via Resend, then strips the block before returning `{ message }` to the client.
- `app/api/sms/route.ts` — Twilio SMS webhook. Receives inbound texts, checks `customers.json` to route existing customers to a live person (email + optional SMS notification to contractor), or handles new customers through the same Nora AI flow. Maintains per-phone conversation history in an in-memory Map. Returns TwiML XML.
- `app/page.tsx` — Minimal React client component. Renders a chat UI that POSTs to `/api/chat` and displays responses. Styled with Tailwind.

### 2. Embeddable widget (`public/`)
- `public/widget.js` — Self-contained IIFE. Injected into a client's existing website via a `<script>` tag. Reads `window.NORA_URL` to know where to POST (e.g. the Vercel deployment URL). No framework dependencies.
- `public/demo.html` — Standalone fake plumber site (Mike's Plumbing) that embeds the widget. Used as a sales demo. Calls `/api/chat` via relative URL — works on any deployment without changes.

### Lead capture flow (web + SMS)
```
User message → POST /api/chat  (web)
              POST /api/sms    (Twilio webhook, form-encoded)
  → Check customers.json (SMS only) → existing: notify contractor + return human-handoff reply
  → Claude API (system prompt instructs Nora to emit <<LEAD>> block when all info collected)
  → Parse block with regex → save to leads.json + notify contractor (email always, SMS if TWILIO_* vars set)
  → Strip block → return clean message to UI / TwiML response to Twilio
```

### SMS — existing customer routing
`customers.json` (repo root, array of `{ name, phone, email, addedAt }`) is the source of truth for existing customers. Phone numbers must be in E.164 format (e.g. `+17205551234`). When a match is found, Nora replies with a handoff message and fires `notifyContractor()`. Add customers manually to this file.

### Per-client customization model
This repo is the **demo/template**. To deploy for a real client:
1. Copy the repo
2. Edit the system prompt in both `route.ts` files (contractor name, issue types, Calendly link)
3. Set `CONTRACTOR_EMAIL` env var (falls back to hardcoded address if unset)
4. Deploy to a new Vercel project with that client's env vars
5. Point the client's Twilio phone number webhook to `https://<vercel-url>/api/sms`

---

## Environment Variables

Required in `nora-agent/.env.local` (never commit):

```
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
CONTRACTOR_EMAIL=...          # defaults to hardcoded address if unset

# SMS — all four required to enable outbound SMS notifications to contractor
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_PHONE=...         # Twilio phone number in E.164 format
TWILIO_CONTRACTOR_PHONE=...   # contractor's cell in E.164 format
```

All vars must also be set in Vercel project settings for production. The Twilio vars are optional — email-only notifications work without them.

---

## Key Constraints

- `leads.json` resets on every Vercel deployment — it is ephemeral. Persistent storage (Supabase, Google Sheets) is a planned P3 item.
- Resend free tier requires domain verification for reliable delivery. The `from:` address uses `onboarding@resend.dev` until a domain is verified.
- The widget's `NORA_URL` must be set to the deployed Vercel URL when embedding on external sites; it defaults to `""` (relative) which only works when served from the same origin.
