import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const db = await createClient();
  const { data: tasks } = await db
    .from("tasks")
    .select("id, title, details, due_date, priority, status")
    .eq("status", "open")
    .order("due_date", { ascending: true, nullsFirst: false });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

  return (
    <>
      <h1>Open tasks</h1>
      <div className="card">
        {!tasks?.length ? (
          <p className="empty">Nothing open. Ask the assistant to remind you of something.</p>
        ) : (
          <table>
            <thead><tr><th>Task</th><th>Due</th><th>Priority</th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}{t.details && <div className="muted">{t.details}</div>}</td>
                  <td style={{ color: t.due_date && t.due_date < today ? "var(--bad)" : undefined }}>
                    {t.due_date ?? "—"}
                  </td>
                  <td><span className={`pill ${t.priority}`}>{t.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
