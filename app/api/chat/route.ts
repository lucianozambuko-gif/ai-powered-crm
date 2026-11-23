import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { openaiTools, runTool } from "@/lib/ai/tools";
import { systemInstructions } from "@/lib/ai/instructions";

export const runtime = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI(); // reads OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 30;

type ToolTrace = { name: string; args: string };

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
  const history = (past ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await db.from("chat_messages").insert({ role: "user", content: message });

  // Agent loop: let the model call tools until it answers in text
  let input: any[] = [...history, { role: "user", content: message }];
  const trace: ToolTrace[] = [];
  let reply = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await openai.responses.create({
        model: MODEL,
        instructions: systemInstructions(),
        input,
        tools: openaiTools,
      });

      const calls = response.output.filter((o: any) => o.type === "function_call") as any[];
      if (calls.length === 0) {
        reply = response.output_text;
        break;
      }

      input = [...input, ...response.output];
      for (const call of calls) {
        trace.push({ name: call.name, args: call.arguments });
        const output = await runTool(db, call.name, call.arguments);
        input.push({ type: "function_call_output", call_id: call.call_id, output });
      }
    }
    if (!reply) reply = "I ran out of steps on that one. Try asking in smaller parts.";
  } catch (e) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : "Assistant failed" }, { status: 500 });
  }

  await db.from("chat_messages").insert({ role: "assistant", content: reply });
  return Response.json({ reply, tools: trace });
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
