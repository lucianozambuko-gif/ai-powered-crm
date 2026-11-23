"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; tools?: { name: string }[] };

const SUGGESTIONS = [
  "What's in my pipeline?",
  "What do I need to do this week?",
  "Add Next Generation Batteries as a client",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => d.messages && setMessages(d.messages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? `Error: ${data.error}`, tools: data.tools },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the server. Check your connection." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="log" ref={logRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask me about your clients, deals and tasks, or tell me something to save.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ghost" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
            {m.tools && m.tools.length > 0 && (
              <div className="tools">Used: {[...new Set(m.tools.map((t) => t.name))].join(", ")}</div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant muted">Working on it…</div>}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          value={text}
          placeholder="Message Cloud CRM…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
