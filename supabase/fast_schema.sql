-- FAST engine — server-side support tables.
-- Complements supabase/migrations/0001_festize_workspace_snapshots.sql.
--
-- The pure business logic lives in src/lib/fast.ts (schedule conflicts,
-- multi-judge scoring, reminders). This schema holds the one thing that must
-- run server-side: the push/SMS fan-out queue for 15-minute schedule
-- reminders (dueReminders() returns the due items; a cron Edge Function
-- drains this table and notifies each recipient).

create table if not exists public.festize_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fest_id text not null,
  user_id text not null,
  cell_id text not null,
  program_id text not null,
  program_name text not null,
  stage_name text not null,
  starts_at timestamptz not null,
  channel text not null default 'push' check (channel in ('push', 'sms', 'email')),
  sent_at timestamptz,
  error text,
  -- One queue row per user per placement (drives the on-conflict idempotency).
  constraint festize_reminder_queue_unique unique (fest_id, user_id, cell_id)
);

create index if not exists festize_reminder_queue_pending_idx
  on public.festize_reminder_queue (starts_at)
  where sent_at is null;

create index if not exists festize_reminder_queue_fest_idx
  on public.festize_reminder_queue (fest_id, user_id);

alter table public.festize_reminder_queue enable row level security;

-- Stored procedure used by a Supabase Edge Function on a 30s tick.
-- The pure logic (dueReminders() in src/lib/fast.ts) runs in the client and
-- posts the due items; this fans them out to every subscribed recipient.
--
-- p_reminders jsonb format (array of objects):
--   [{ "cellId": "...", "programId": "...", "programName": "...",
--      "stageName": "...", "startsAt": 1793000000000, "minutesAway": 4 }]
-- p_recipient_ids text[]: user ids subscribed to those placements
--   (bookmarks / team / judge assignments resolved server-side).
create or replace function public.enqueue_due_reminders(
  p_fest_id text,
  p_reminders jsonb,
  p_recipient_ids text[],
  p_channel text default 'push'
) returns integer
language plpgsql
as $$
declare
  inserted integer := 0;
begin
  if p_reminders is null or jsonb_typeof(p_reminders) <> 'array' then
    return 0;
  end if;

  insert into public.festize_reminder_queue
    (fest_id, user_id, cell_id, program_id, program_name, stage_name, starts_at, channel)
  select
    p_fest_id,
    recipient,
    reminder->>'cellId',
    reminder->>'programId',
    reminder->>'programName',
    reminder->>'stageName',
    to_timestamp(((reminder->>'startsAt')::bigint) / 1000.0),
    p_channel
  from jsonb_array_elements(p_reminders) as reminder
  cross join unnest(p_recipient_ids) as recipient
  where reminder->>'cellId' is not null
    and reminder->>'programId' is not null
  on conflict do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- DEMO POLICY: full access for the anon key in local development.
-- Replace with user-scoped policies before production use.
create policy "festize reminder demo allow all"
  on public.festize_reminder_queue
  for all
  using (true)
  with check (true);
