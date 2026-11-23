import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatTools, runTool } from "./tools";
import { systemInstructions } from "./instructions";

/**
 * Which AI server to use. The OpenAI SDK talks to any OpenAI-compatible
 * server, so switching provider is just these three settings:
 *
 *   Ollama (free, on your own computer)
 *     AI_BASE_URL=http://localhost:11434/v1   AI_API_KEY=ollama   AI_MODEL=qwen3:8b
 *   Groq (free tier, hosted open-source models)
 *     AI_BASE_URL=https://api.groq.com/openai/v1   AI_API_KEY=gsk_...   AI_MODEL=openai/gpt-oss-120b
 *   OpenAI (paid)
 *     AI_BASE_URL=   (leave empty)   AI_API_KEY=sk-...   AI_MODEL=gpt-6.1-terra
 */
export function aiConfig() {
  return {
    baseURL: process.env.AI_BASE_URL || undefined,
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "none",
    model: process.env.AI_MODEL || process.env.OPENAI_MODEL || "qwen3:8b",
  };
}

export type Turn = { role: "user" | "assistant"; content: string };
export type ToolTrace = { name: string; args: string };

const MAX_TOOL_ROUNDS = 8;

/** Runs the assistant: lets the model call CRM tools until it answers in plain text. */
export async function runAgent(
  db: SupabaseClient,
  history: Turn[],
  message: string,
  client?: OpenAI,
): Promise<{ reply: string; tools: ToolTrace[] }> {
  const cfg = aiConfig();
  const ai = client ?? new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstructions() },
    ...history,
    { role: "user", content: message },
  ];
  const trace: ToolTrace[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await ai.chat.completions.create({
      model: cfg.model,
      messages,
      tools: chatTools,
    });
    const msg = res.choices[0]?.message;
    if (!msg) break;

    const calls = (msg.tool_calls ?? []).filter((c) => c.type === "function");
    if (calls.length === 0) {
      return { reply: stripThinking(msg.content ?? ""), tools: trace };
    }

    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
    for (const call of calls) {
      trace.push({ name: call.function.name, args: call.function.arguments });
      const output = await runTool(db, call.function.name, call.function.arguments);
      messages.push({ role: "tool", tool_call_id: call.id, content: output });
    }
  }

  return { reply: "I ran out of steps on that one. Try asking in smaller parts.", tools: trace };
}

/** Some open models (e.g. Qwen3) put their reasoning in <think> tags; hide it. */
function stripThinking(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
