# Cloud CRM

Tony's personal CRM with an OpenAI assistant built in. Phase 1: contacts, companies, deals, tasks, notes, and a chat assistant that reads and writes them. Runs as an installable app (PWA) on phone and laptop.

## Stack

- Next.js 16 (App Router, TypeScript)
- Supabase: Postgres, Auth (email magic link), Row Level Security
- OpenAI Responses API with function calling (the agent loop is in `app/api/chat/route.ts`)

## Set up (about 15 minutes)

1. **Supabase project.** Already created: `cloud-crm` (ref `sgohyokchjyoiyucqnrj`, eu-central-1) with both migrations applied. The URL and publishable key are pre-filled in `.env.example` (they are safe to be public; Row Level Security protects the data).
2. **Auth.** Supabase → Authentication → URL Configuration: set Site URL to `http://localhost:3000` (later, your live URL) and add `http://localhost:3000/auth/callback` to Redirect URLs.
3. **Env vars.** Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API)
   - `OPENAI_API_KEY` (platform.openai.com → API keys). Keep it server-side, never `NEXT_PUBLIC_`.
   - `OPENAI_MODEL` (any model your account can use with the Responses API)
   - `ALLOWED_EMAIL` = the only email allowed to sign in
4. **Run it.**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, sign in with the magic link, and start chatting.

## Put it on your phone

Deploy to Vercel (or Render), add the same env vars there, and add `https://YOUR-APP/auth/callback` to Supabase's Redirect URLs. Then open the site on your phone:
- **Android (Chrome):** menu → Install app
- **iPhone (Safari):** Share → Add to Home Screen

## How the assistant works

- `lib/ai/tools.ts` lists every tool: its JSON schema (sent to OpenAI) and the code that runs it with your Supabase session, so Row Level Security still applies.
- `app/api/chat/route.ts` sends your message plus recent history to OpenAI, runs any tool calls the model asks for, feeds the results back, and repeats until it answers (max 8 rounds).
- Risky actions never run directly. `request_delete` saves a row in `approvals`; it only runs when you tap **Approve** on the Approvals page.

### Add a tool

Add an entry to the `tools` array in `lib/ai/tools.ts` with a `name`, `description`, `parameters` schema and `run(db, args)`. The assistant picks it up on the next request. For anything that sends, pays or deletes, create an approval row instead and handle it in `runApproved`.

## Next phases

1. ~~Core CRM + chat assistant~~ (this)
2. Meetings: record, transcribe, summarise, create tasks; email/WhatsApp reply drafts; quotes and invoices
3. Role agents: HR, developer (GitHub, Render, Vercel), security checks
4. Realtime voice assistant, push alerts, daily brief
