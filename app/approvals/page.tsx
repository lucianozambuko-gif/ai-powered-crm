import { createClient } from "@/lib/supabase/server";
import { Decide } from "./decide";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const db = await createClient();
  const { data: rows } = await db
    .from("approvals")
    .select("id, summary, status, result, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <h1>Approvals</h1>
      <p className="muted">The assistant asks here before doing anything risky.</p>
      <div className="card">
        {!rows?.length ? (
          <p className="empty">Nothing waiting.</p>
        ) : (
          <table>
            <thead><tr><th>Action</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.summary}
                    <div className="muted">{new Date(r.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</div>
                    {r.result && <div className="muted">{r.result}</div>}
                  </td>
                  <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                  <td>{r.status === "pending" && <Decide id={r.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
