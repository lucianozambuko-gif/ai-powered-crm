-- Indexes on foreign keys (flagged by the Supabase performance advisor)
create index on public.contacts (company_id);
create index on public.deals (company_id);
create index on public.deals (contact_id);
create index on public.notes (company_id);
create index on public.notes (contact_id);
create index on public.notes (deal_id);
create index on public.tasks (contact_id);
create index on public.tasks (deal_id);
