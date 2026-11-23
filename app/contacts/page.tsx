import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const db = await createClient();
  const { data: contacts } = await db
    .from("contacts")
    .select("id, full_name, email, phone, role, kind, companies(name)")
    .order("full_name");

  return (
    <>
      <h1>Contacts</h1>
      <div className="card">
        {!contacts?.length ? (
          <p className="empty">No contacts yet. Tell the assistant about a client to add one.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Company</th><th className="hide-sm">Email</th><th>Phone</th><th className="hide-sm">Type</th></tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.full_name}<div className="muted">{c.role}</div></td>
                  <td>{c.companies?.name ?? "—"}</td>
                  <td className="hide-sm">{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                  <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}</td>
                  <td className="hide-sm"><span className="pill">{c.kind}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
