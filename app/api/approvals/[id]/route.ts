import { createClient } from "@/lib/supabase/server";
import { runApproved } from "@/lib/ai/tools";

// POST /api/approvals/:id  body: { decision: "approve" | "reject" }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision } = (await req.json()) as { decision?: string };
  const db = await createClient();

  const { data: row, error } = await db.from("approvals").select("*").eq("id", id).single();
  if (error || !row) return Response.json({ error: "Approval not found" }, { status: 404 });
  if (row.status !== "pending") return Response.json({ error: `Already ${row.status}` }, { status: 409 });

  if (decision === "reject") {
    await db.from("approvals").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ status: "rejected" });
  }
  if (decision !== "approve") return Response.json({ error: "decision must be approve or reject" }, { status: 400 });

  try {
    const result = await runApproved(db, row.action, row.payload);
    await db.from("approvals").update({ status: "done", result, decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ status: "done", result });
  } catch (e) {
    const result = e instanceof Error ? e.message : String(e);
    await db.from("approvals").update({ status: "failed", result, decided_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ status: "failed", result }, { status: 500 });
  }
}
