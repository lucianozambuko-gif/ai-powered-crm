"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Decide({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button disabled={busy} onClick={() => decide("approve")}>Approve</button>
      <button disabled={busy} className="ghost" onClick={() => decide("reject")}>Reject</button>
    </div>
  );
}
