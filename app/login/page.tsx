"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <form className="login card" onSubmit={signIn}>
      <h1>Sign in to Cloud CRM</h1>
      {state === "sent" ? (
        <p>Check {email} for your sign-in link. Open it on this device.</p>
      ) : (
        <>
          <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
          {state === "error" && <p style={{ color: "var(--bad)" }}>{error}</p>}
        </>
      )}
    </form>
  );
}
