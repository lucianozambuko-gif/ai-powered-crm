import { createClient } from "@/lib/supabase/server";
import { runAgent, type Turn } from "@/lib/ai/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

// Fewer past messages = fewer tokens per request. Keep this small on free tiers.
const HISTORY_LIMIT = Number(process.env.AI_HISTORY_LIMIT || 12);

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) return Response.json({ error: "Empty message" }, { status: 400 });

  // Recent history, oldest first
  const { data: past } = await db
    .from("chat_messages")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = (past ?? []).reverse() as Turn[];

  await db.from("chat_messages").insert({ role: "user", content: message });

  try {
    const { reply, tools } = await runAgent(db, history, message);
    await db.from("chat_messages").insert({ role: "assistant", content: reply });
    return Response.json({ reply, tools });
  } catch (e) {
    console.error(e);
    const status = (e as { status?: number }).status;
    const error =
      status === 429
        ? "The AI provider's free limit was hit. Wait a minute and try again."
        : e instanceof Error ? e.message : "Assistant failed";
    return Response.json({ error }, { status: 500 });
  }
}

export async function GET() {
  const db = await createClient();
  const { data, error } = await db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ messages: (data ?? []).reverse() });
}
