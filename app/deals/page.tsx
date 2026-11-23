import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const zar = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

export default async function DealsPage() {
  const db = await createClient();
  const { data: deals } = await db
    .from("deals")
    .select("id, title, stage, value_zar, expected_close, companies(name)")
    .order("updated_at", { ascending: false });

  const open = (deals ?? []).filter((d) => !["won", "delivered", "lost"].includes(d.stage));
  const openValue = open.reduce((s, d) => s + Number(d.value_zar ?? 0), 0);

  return (
    <>
      <h1>Deals</h1>
      <p className="muted">{open.length} open · {zar(openValue)} in the pipeline</p>
      <div className="card">
        {!deals?.length ? (
          <p className="empty">No deals yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Deal</th><th>Client</th><th>Stage</th><th>Value</th><th className="hide-sm">Close</th></tr>
            </thead>
            <tbody>
              {deals.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.companies?.name ?? "—"}</td>
                  <td><span className={`pill ${d.stage}`}>{d.stage.replace("_", " ")}</span></td>
                  <td>{zar(d.value_zar)}</td>
                  <td className="hide-sm">{d.expected_close ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
