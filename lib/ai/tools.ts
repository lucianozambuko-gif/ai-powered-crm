import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tools the assistant can call. Each has a JSON schema (sent to OpenAI) and a
 * `run` function (executed on our server with the signed-in user's Supabase
 * client, so Row Level Security still applies).
 *
 * Anything destructive goes through `request_approval` instead of running
 * directly: it creates a row in `approvals` that Tony approves in the app.
 */

type Args = Record<string, any>;
type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (db: SupabaseClient, args: Args) => Promise<unknown>;
};

const str = (description: string) => ({ type: "string", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const CONTACT_KINDS = ["client", "lead", "partner", "contractor", "supplier", "other"];
const DEAL_STAGES = ["lead", "quoted", "negotiating", "won", "in_progress", "delivered", "lost"];
const DELETABLE = ["contacts", "companies", "deals", "tasks", "notes"];

/** Escape characters that have meaning inside a Postgres ILIKE pattern. */
const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Find a company by name, or create it. Returns its id. */
async function companyId(db: SupabaseClient, name?: string): Promise<string | null> {
  if (!name?.trim()) return null;
  const found = must(await db.from("companies").select("id").ilike("name", name.trim()).limit(1));
  if (found?.length) return found[0].id;
  const created = must(await db.from("companies").insert({ name: name.trim() }).select("id").single());
  return created?.id ?? null;
}

export const tools: Tool[] = [
  {
    name: "search_crm",
    description:
      "Search contacts, companies and deals by name, email, phone or title. Use before creating anything to avoid duplicates, and whenever Tony asks about a person, client or project.",
    parameters: obj({ query: str("Words to search for") }, ["query"]),
    async run(db, { query }) {
      // Commas, brackets and quotes would break PostgREST's or() filter syntax
      const q = like(String(query).replace(/[,()"]/g, " ").trim());
      const [contacts, companies, deals] = await Promise.all([
        db.from("contacts").select("id, full_name, email, phone, role, kind, company_id, notes")
          .or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`).limit(10),
        db.from("companies").select("id, name, website, industry, notes").ilike("name", q).limit(10),
        db.from("deals").select("id, title, stage, value_zar, expected_close, company_id, notes")
          .ilike("title", q).limit(10),
      ]);
      return { contacts: must(contacts), companies: must(companies), deals: must(deals) };
    },
  },
  {
    name: "create_contact",
    description: "Add a person to the CRM. If company_name is given, links them to that company (creating it if new).",
    parameters: obj(
      {
        full_name: str("Person's full name"),
        email: str("Email address"),
        phone: str("Phone number, e.g. 074 092 6666"),
        role: str("Their job title or role"),
        kind: { type: "string", enum: CONTACT_KINDS, description: "Relationship type" },
        company_name: str("Company they belong to"),
        notes: str("Anything worth remembering"),
      },
      ["full_name"],
    ),
    async run(db, a) {
      const company_id = await companyId(db, a.company_name);
      return must(
        await db.from("contacts").insert({
          full_name: a.full_name, email: a.email, phone: a.phone, role: a.role,
          kind: a.kind ?? "client", notes: a.notes, company_id,
        }).select().single(),
      );
    },
  },
  {
    name: "create_company",
    description: "Add a company (client, supplier or partner).",
    parameters: obj(
      { name: str("Company name"), website: str("Website URL"), industry: str("Industry"), notes: str("Notes") },
      ["name"],
    ),
    async run(db, a) {
      return must(await db.from("companies").insert(a).select().single());
    },
  },
  {
    name: "create_deal",
    description: "Create a deal or project for a client, e.g. a website build or ERP rollout.",
    parameters: obj(
      {
        title: str("Short name of the deal or project"),
        company_name: str("Client company"),
        contact_id: str("Main contact's id, from search_crm"),
        stage: { type: "string", enum: DEAL_STAGES },
        value_zar: { type: "number", description: "Value in South African rand" },
        expected_close: str("Expected close or delivery date, YYYY-MM-DD"),
        notes: str("Notes"),
      },
      ["title"],
    ),
    async run(db, a) {
      const company_id = await companyId(db, a.company_name);
      return must(
        await db.from("deals").insert({
          title: a.title, company_id, contact_id: a.contact_id, stage: a.stage ?? "lead",
          value_zar: a.value_zar, expected_close: a.expected_close, notes: a.notes,
        }).select().single(),
      );
    },
  },
  {
    name: "update_deal",
    description: "Change a deal's stage, value, date or notes.",
    parameters: obj(
      {
        deal_id: str("Deal id, from search_crm"),
        stage: { type: "string", enum: DEAL_STAGES },
        value_zar: { type: "number" },
        expected_close: str("YYYY-MM-DD"),
        notes: str("Replaces the deal's notes"),
      },
      ["deal_id"],
    ),
    async run(db, { deal_id, ...changes }) {
      return must(await db.from("deals").update(changes).eq("id", deal_id).select().single());
    },
  },
  {
    name: "pipeline_summary",
    description: "Count and total value of deals per stage. Use for 'how's business', 'what's in my pipeline'.",
    parameters: obj({}),
    async run(db) {
      const deals = must(await db.from("deals").select("stage, value_zar, title, expected_close"));
      const byStage: Record<string, { count: number; value_zar: number; titles: string[] }> = {};
      for (const d of deals ?? []) {
        const s = (byStage[d.stage] ??= { count: 0, value_zar: 0, titles: [] });
        s.count++;
        s.value_zar += Number(d.value_zar ?? 0);
        s.titles.push(d.title);
      }
      return byStage;
    },
  },
  {
    name: "create_task",
    description: "Create a task or follow-up reminder.",
    parameters: obj(
      {
        title: str("What needs doing"),
        details: str("More detail"),
        due_date: str("YYYY-MM-DD"),
        priority: { type: "string", enum: ["low", "normal", "high"] },
        deal_id: str("Related deal id"),
        contact_id: str("Related contact id"),
      },
      ["title"],
    ),
    async run(db, a) {
      return must(await db.from("tasks").insert(a).select().single());
    },
  },
  {
    name: "list_tasks",
    description: "List tasks. Defaults to open tasks, soonest due first.",
    parameters: obj({
      status: { type: "string", enum: ["open", "done", "cancelled"] },
      due_before: str("Only tasks due on or before this date, YYYY-MM-DD"),
    }),
    async run(db, { status = "open", due_before }) {
      let q = db.from("tasks").select("id, title, details, due_date, priority, status, deal_id, contact_id")
        .eq("status", status).order("due_date", { ascending: true, nullsFirst: false }).limit(50);
      if (due_before) q = q.lte("due_date", due_before);
      return must(await q);
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done.",
    parameters: obj({ task_id: str("Task id") }, ["task_id"]),
    async run(db, { task_id }) {
      return must(await db.from("tasks").update({ status: "done" }).eq("id", task_id).select().single());
    },
  },
  {
    name: "add_note",
    description: "Save a note, optionally linked to a contact, company or deal.",
    parameters: obj(
      { body: str("The note"), contact_id: str("Contact id"), company_id: str("Company id"), deal_id: str("Deal id") },
      ["body"],
    ),
    async run(db, a) {
      return must(await db.from("notes").insert({ ...a, source: "assistant" }).select().single());
    },
  },
  {
    name: "request_delete",
    description:
      "Ask Tony to approve deleting a record. Never delete directly. Creates an approval he must accept in the Approvals page.",
    parameters: obj(
      {
        table: { type: "string", enum: DELETABLE },
        id: str("Id of the record to delete"),
        summary: str("Plain description, e.g. 'Delete contact John Doe (duplicate)'"),
      },
      ["table", "id", "summary"],
    ),
    async run(db, { table, id, summary }) {
      const row = must(
        await db.from("approvals").insert({ action: "delete_record", summary, payload: { table, id } })
          .select("id, summary, status").single(),
      );
      return { ...row, note: "Waiting for Tony's approval in the Approvals page." };
    },
  },
];

/** Tool list in the shape the OpenAI Responses API expects. */
export const openaiTools = tools.map((t) => ({
  type: "function" as const,
  name: t.name,
  description: t.description,
  parameters: t.parameters,
  strict: false,
}));

export async function runTool(db: SupabaseClient, name: string, rawArgs: string): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: `Unknown tool ${name}` });
  try {
    const args = rawArgs ? JSON.parse(rawArgs) : {};
    // Drop empty values the model sometimes sends
    for (const k of Object.keys(args)) if (args[k] === "" || args[k] === null) delete args[k];
    return JSON.stringify(await tool.run(db, args));
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

/** Runs an approved action. Only called from the approvals endpoint. */
export async function runApproved(db: SupabaseClient, action: string, payload: Args) {
  if (action === "delete_record") {
    if (!DELETABLE.includes(payload.table)) throw new Error("Table not allowed");
    must(await db.from(payload.table).delete().eq("id", payload.id));
    return `Deleted ${payload.table} ${payload.id}`;
  }
  throw new Error(`Unknown action ${action}`);
}
