-- Cloud CRM: Phase 1 schema
-- Every row belongs to the signed-in user (owner_id) and Row Level Security
-- makes sure only that user can see or change it.

create extension if not exists pgcrypto;

-- Companies (clients, suppliers, partners)
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  website     text,
  industry    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- People
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  role        text,
  kind        text not null default 'client'
              check (kind in ('client', 'lead', 'partner', 'contractor', 'supplier', 'other')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Deals / projects you are selling or delivering
create table public.deals (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id   uuid references public.companies (id) on delete set null,
  contact_id   uuid references public.contacts (id) on delete set null,
  title        text not null,
  stage        text not null default 'lead'
               check (stage in ('lead', 'quoted', 'negotiating', 'won', 'in_progress', 'delivered', 'lost')),
  value_zar    numeric(12, 2),
  expected_close date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Tasks and follow-ups
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deal_id     uuid references public.deals (id) on delete set null,
  contact_id  uuid references public.contacts (id) on delete set null,
  title       text not null,
  details     text,
  due_date    date,
  status      text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Free-form notes (meeting notes, call notes, ideas) linked to anything
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  deal_id     uuid references public.deals (id) on delete cascade,
  body        text not null,
  source      text not null default 'manual' check (source in ('manual', 'assistant', 'meeting', 'email')),
  created_at  timestamptz not null default now()
);

-- Actions the assistant wants to take that need Tony's approval first
create table public.approvals (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action      text not null,          -- e.g. 'delete_record'
  summary     text not null,          -- human-readable: what will happen
  payload     jsonb not null,         -- exact arguments to run
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'done', 'failed')),
  result      text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

-- Chat history with the assistant
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Indexes
create index on public.contacts (owner_id, full_name);
create index on public.companies (owner_id, name);
create index on public.deals (owner_id, stage);
create index on public.tasks (owner_id, status, due_date);
create index on public.notes (owner_id, created_at desc);
create index on public.approvals (owner_id, status);
create index on public.chat_messages (owner_id, created_at);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();
create trigger contacts_touch  before update on public.contacts  for each row execute function public.touch_updated_at();
create trigger deals_touch     before update on public.deals     for each row execute function public.touch_updated_at();
create trigger tasks_touch     before update on public.tasks     for each row execute function public.touch_updated_at();

-- Row Level Security: owner only
do $$
declare t text;
begin
  foreach t in array array['companies', 'contacts', 'deals', 'tasks', 'notes', 'approvals', 'chat_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner can do everything" on public.%I for all to authenticated
         using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
  end loop;
end $$;
