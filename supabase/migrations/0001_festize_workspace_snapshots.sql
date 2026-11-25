-- Festize workspace cloud snapshots
-- Stores full JSON snapshots of the Festize application state so a festival
-- secretariat can sync tabulation data, designs and settings across devices.

create table if not exists public.festize_workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  label text,
  payload jsonb not null
);

create index if not exists festize_workspace_snapshots_created_at_idx
  on public.festize_workspace_snapshots (created_at desc);

alter table public.festize_workspace_snapshots enable row level security;

-- DEMO POLICY: allow the anon key full access.
-- Replace with authenticated user-scoped policies before production use,
-- e.g.  create policy "users manage own snapshots"
--         on public.festize_workspace_snapshots for all
--         using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "festize demo allow all"
  on public.festize_workspace_snapshots
  for all
  using (true)
  with check (true);
