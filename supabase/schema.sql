-- Run this in the Supabase SQL editor before connecting the app.
create extension if not exists pgcrypto;

create table if not exists public.fests (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  code text not null unique,
  date text not null,
  main_users jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fest_members (
  id uuid primary key,
  fest_id uuid not null references public.fests(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  role text not null check (role in ('MAIN', 'JUDGE', 'MEDIA', 'TEAM MANAGER', 'MONITOR', 'STAGE MANAGER', 'MEMBER')),
  team_id text,
  member_id text,
  created_at timestamptz not null default now(),
  unique (fest_id, auth_user_id)
);
create unique index if not exists fest_members_unique_username on public.fest_members(fest_id, lower(username));
create index if not exists fest_members_auth_index on public.fest_members(auth_user_id, fest_id);

create table if not exists public.fest_snapshots (
  fest_id uuid primary key references public.fests(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_fest_member(target_fest uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.fest_members m
    where m.fest_id = target_fest and m.auth_user_id = auth.uid()
  );
$$;

create or replace function public.can_write_fest(target_fest uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.fests f where f.id = target_fest and f.owner_id = auth.uid()
  ) or exists (
    select 1 from public.fest_members m
    where m.fest_id = target_fest and m.auth_user_id = auth.uid() and m.role <> 'MEMBER'
  );
$$;

revoke all on function public.is_fest_member(uuid) from public;
revoke all on function public.can_write_fest(uuid) from public;
grant execute on function public.is_fest_member(uuid) to authenticated;
grant execute on function public.can_write_fest(uuid) to authenticated;

alter table public.fests enable row level security;
alter table public.fest_members enable row level security;
alter table public.fest_snapshots enable row level security;

create policy "owners and members read their fest" on public.fests for select to authenticated
using (owner_id = auth.uid() or public.is_fest_member(id));
create policy "owners create fests" on public.fests for insert to authenticated
with check (owner_id = auth.uid());
create policy "owners edit fests" on public.fests for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete fests" on public.fests for delete to authenticated
using (owner_id = auth.uid());

create policy "members read their own membership" on public.fest_members for select to authenticated
using (auth_user_id = auth.uid() or exists (
  select 1 from public.fests f where f.id = fest_id and f.owner_id = auth.uid()
));

create policy "fest participants read one snapshot" on public.fest_snapshots for select to authenticated
using (owner_id = auth.uid() or public.is_fest_member(fest_id));
create policy "fest owner creates snapshot" on public.fest_snapshots for insert to authenticated
with check (owner_id = auth.uid() and exists (
  select 1 from public.fests f where f.id = fest_id and f.owner_id = auth.uid()
));
create policy "non-member-readonly staff edit their snapshot" on public.fest_snapshots for update to authenticated
using (public.can_write_fest(fest_id)) with check (public.can_write_fest(fest_id));

-- Real-time updates are filtered by the same RLS policies.
alter table public.fest_snapshots replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.fest_snapshots;
exception when duplicate_object then null;
end $$;