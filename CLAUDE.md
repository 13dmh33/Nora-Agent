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
- `app/api/chat/route.ts` — The only backend. Receives `{ messages }` (full conversation history), calls Claude API with a hardcoded plumbing system prompt, detects a `<<LEAD>>...<<END>>` block in the response, saves the lead to `leads.json`, sends an email via Resend, then strips the block before returning `{ message }` to the client.
- `app/page.tsx` — Minimal React client component. Renders a chat UI that POSTs to `/api/chat` and displays responses. Styled with Tailwind.

### 2. Embeddable widget (`public/`)
- `public/widget.js` — Self-contained IIFE. Injected into a client's existing website via a `<script>` tag. Reads `window.NORA_URL` to know where to POST (e.g. the Vercel deployment URL). No framework dependencies.
- `public/demo.html` — Standalone fake plumber site (Mike's Plumbing) that embeds the widget. Used as a sales demo. Calls `/api/chat` via relative URL — works on any deployment without changes.

### Lead capture flow
```
User message → POST /api/chat
  → Claude API (system prompt instructs Nora to emit <<LEAD>> block when all info collected)
  → Parse block with regex → save to leads.json + send Resend email
  → Strip block from text → return clean message to UI
```

### Per-client customization model
This repo is the **demo/template**. To deploy for a real client:
1. Copy the repo
2. Edit the system prompt in `route.ts` (contractor name, issue types, Calendly link)
3. Update the Resend `to:` address to the contractor's email
4. Deploy to a new Vercel project with that client's env vars

---

## Environment Variables

Required in `nora-agent/.env.local` (never commit):

```
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
```

Both must also be set in Vercel project settings for production.

---

## Key Constraints

- `leads.json` resets on every Vercel deployment — it is ephemeral. Persistent storage (Supabase, Google Sheets) is a planned P3 item.
- Resend free tier requires domain verification for reliable delivery. The `from:` address uses `onboarding@resend.dev` until a domain is verified.
- The widget's `NORA_URL` must be set to the deployed Vercel URL when embedding on external sites; it defaults to `""` (relative) which only works when served from the same origin.
