# Cloud CRM

Tony's personal CRM with an OpenAI assistant built in. Phase 1: contacts, companies, deals, tasks, notes, and a chat assistant that reads and writes them. Runs as an installable app (PWA) on phone and laptop.

## Stack

- Next.js 16 (App Router, TypeScript)
- Supabase: Postgres, Auth (email magic link), Row Level Security
- Any OpenAI-compatible AI server: Ollama (free, local), Groq (free tier) or OpenAI (paid). The agent loop is in `lib/ai/agent.ts`

## Set up (about 15 minutes)

1. **Supabase project.** Already created: `cloud-crm` (ref `sgohyokchjyoiyucqnrj`, eu-central-1) with both migrations applied. The URL and publishable key are pre-filled in `.env.example` (they are safe to be public; Row Level Security protects the data).
2. **Auth.** Supabase → Authentication → URL Configuration: set Site URL to `http://localhost:3000` (later, your live URL) and add `http://localhost:3000/auth/callback` to Redirect URLs.
3. **Env vars.** Copy `.env.example` to `.env.local`, set `ALLOWED_EMAIL`, and uncomment ONE AI provider block:
   - **Groq (free, easiest):** sign up at console.groq.com, create an API key, paste it into `AI_API_KEY`.
   - **Ollama (free, private, runs on your computer):** install from ollama.com, run `ollama pull qwen3:8b`, keep Ollama open.
   - **OpenAI (paid):** paste your `sk-` key.
4. **Run it.**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, sign in with the magic link, and start chatting.

## Put it on your phone (Ollama setup)

With Ollama the AI runs on your laptop, so the whole app runs there too, and your phone reaches it privately through Tailscale (free).

1. On the laptop, run the app in production mode:
   ```bash
   npm run build
   npm start
   ```
2. Install Tailscale on the laptop and the phone (tailscale.com/download) and sign in to both with the same account.
3. On the laptop, run `tailscale serve --bg 3000`. It prints an HTTPS address like `https://your-laptop.tail1234.ts.net`.
4. In Supabase → Authentication → URL Configuration, add `https://your-laptop.tail1234.ts.net/auth/callback` to Redirect URLs.
5. Open that address on your phone and install it:
   - **Android (Chrome):** menu → Install app
   - **iPhone (Safari):** Share → Add to Home Screen

The laptop must be on, with Ollama and `npm start` running, for the assistant to answer.

If you later switch to Groq or OpenAI instead, you can deploy to Vercel and skip Tailscale.

## How the assistant works

- `lib/ai/tools.ts` lists every tool: its JSON schema (sent to OpenAI) and the code that runs it with your Supabase session, so Row Level Security still applies.
- `lib/ai/agent.ts` sends your message plus recent history to the AI server, runs any tool calls the model asks for, feeds the results back, and repeats until it answers (max 8 rounds). It uses the Chat Completions format, which Ollama, Groq, OpenRouter, LM Studio and OpenAI all support, so switching provider is just the three `AI_` settings.
- Risky actions never run directly. `request_delete` saves a row in `approvals`; it only runs when you tap **Approve** on the Approvals page.

### Add a tool

Add an entry to the `tools` array in `lib/ai/tools.ts` with a `name`, `description`, `parameters` schema and `run(db, args)`. The assistant picks it up on the next request. For anything that sends, pays or deletes, create an approval row instead and handle it in `runApproved`.

## Next phases

1. ~~Core CRM + chat assistant~~ (this)
2. Meetings: record, transcribe, summarise, create tasks; email/WhatsApp reply drafts; quotes and invoices
3. Role agents: HR, developer (GitHub, Render, Vercel), security checks
4. Realtime voice assistant, push alerts, daily brief
