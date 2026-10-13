-- ============================================================================
-- FAST — Fest Management System: Schedule + Multi-Judge Scoring schema
-- ----------------------------------------------------------------------------
-- Relational (PostgreSQL / Supabase) DDL below. Prisma + Mongoose equivalents
-- are included as comments so the same model ports to any stack.
-- Event <-> Judge uses a JUNCTION table (no hardcoded 3-judge limit):
--   one row in event_judges per (event, judge). 2, 5, 9 judges = 2, 5, 9 rows.
-- Scores are one row per (event, entry, judge): judges submit independently,
-- RLS guarantees a judge can only read/write their OWN rows (isolation).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- Venues / stages --------------------------------------------------------
create table if not exists public.fast_venues (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references public.fests(id) on delete cascade,
  name text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists fast_venues_fest_idx on public.fast_venues(fest_id);

-- ---- Events (programs) ------------------------------------------------------
-- scoring_method: 'average' | 'trimmed' | 'auto' (auto = <5 avg, 5+ trimmed).
create table if not exists public.fast_events (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references public.fests(id) on delete cascade,
  venue_id uuid references public.fast_venues(id) on delete set null,
  name text not null,
  category_id text,
  format text not null default 'Individual' check (format in ('Individual','Group')),
  scoring_method text not null default 'auto' check (scoring_method in ('average','trimmed','auto')),
  status int not null default -1,
  created_at timestamptz not null default now()
);
create index if not exists fast_events_fest_idx on public.fast_events(fest_id);

-- ---- Junction: event_id -> N judge_ids (THE multi-judge mapping) ------------
create table if not exists public.fast_event_judges (
  event_id uuid not null references public.fast_events(id) on delete cascade,
  judge_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (event_id, judge_id)
);
create index if not exists fast_event_judges_judge_idx on public.fast_event_judges(judge_id, event_id);

-- ---- Entries (candidates / code letters) ------------------------------------
create table if not exists public.fast_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.fast_events(id) on delete cascade,
  code_letter text,
  team_id text,
  member_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists fast_entries_event_idx on public.fast_entries(event_id);

-- ---- Scores: ONE row per (entry, judge). Judges never share a row. ----------
create table if not exists public.fast_scores (
  entry_id uuid not null references public.fast_entries(id) on delete cascade,
  judge_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.fast_events(id) on delete cascade,
  mark numeric(5,2) not null check (mark >= 0 and mark <= 100),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entry_id, judge_id)
);
create index if not exists fast_scores_event_idx on public.fast_scores(event_id, entry_id);

-- ---- Schedule placements (multi-stage / multi-day grid cells) ---------------
create table if not exists public.fast_schedule_cells (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references public.fests(id) on delete cascade,
  event_id uuid not null references public.fast_events(id) on delete cascade,
  venue_id uuid not null references public.fast_venues(id) on delete cascade,
  day date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  delay_minutes int not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists fast_schedule_fest_day_idx on public.fast_schedule_cells(fest_id, day, starts_at);

-- ---- Bookmarks (personalisation, per user) ----------------------------------
create table if not exists public.fast_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.fast_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---- Reminder queue (15-min push/SMS fan-out, claimed by a worker) ----------
create table if not exists public.fast_reminders (
  id uuid primary key default gen_random_uuid(),
  fest_id uuid not null references public.fests(id) on delete cascade,
  cell_id uuid not null references public.fast_schedule_cells(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  channel text not null default 'push' check (channel in ('push','sms','inapp')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fast_reminders_due_idx on public.fast_reminders(remind_at) where sent_at is null;

-- ============================================================================
-- SCORING FUNCTIONS (run inside Postgres; mirror src/lib/fast.ts exactly)
-- ============================================================================

-- Dynamic Average: sum(active marks) / count(active marks). NULL when empty.
create or replace function public.fast_dynamic_average(p_event uuid, p_entry uuid)
returns numeric language sql stable as $$
  select case when count(*) = 0 then null
    else round(avg(mark)::numeric, 1) end
  from public.fast_scores s
  join public.fast_event_judges j
    on j.event_id = s.event_id and j.judge_id = s.judge_id and j.is_active
  where s.event_id = p_event and s.entry_id = p_entry;
$$;

-- Olympic Trimmed Mean: drop highest + lowest, average the rest (5+ ideal).
-- Falls back to dynamic average when fewer than 3 scores exist.
create or replace function public.fast_trimmed_mean(p_event uuid, p_entry uuid)
returns numeric language plpgsql stable as $$
declare
  marks numeric[]; trimmed numeric[];
begin
  select array_agg(mark order by mark) into marks
  from public.fast_scores s
  join public.fast_event_judges j
    on j.event_id = s.event_id and j.judge_id = s.judge_id and j.is_active
  where s.event_id = p_event and s.entry_id = p_entry;
  if marks is null or array_length(marks, 1) = 0 then return null; end if;
  if array_length(marks, 1) < 3 then return public.fast_dynamic_average(p_event, p_entry); end if;
  trimmed := marks[2:array_length(marks,1)-1];
  return (select round(avg(m)::numeric, 1) from unnest(trimmed) m);
end $$;

-- Router: respects fast_events.scoring_method ('average' | 'trimmed' | 'auto').
create or replace function public.fast_final_mark(p_event uuid, p_entry uuid)
returns numeric language plpgsql stable as $$
declare method text; panel int;
begin
  select scoring_method into method from public.fast_events where id = p_event;
  select count(*) into panel from public.fast_event_judges where event_id = p_event and is_active;
  if method = 'trimmed' or (method = 'auto' and panel >= 5) then
    return public.fast_trimmed_mean(p_event, p_entry);
  end if;
  return public.fast_dynamic_average(p_event, p_entry);
end $$;

-- ============================================================================
-- SECURITY: judge isolation via RLS
-- A judge reads ONLY their own score rows (+ counts via a secure function).
-- ============================================================================
alter table public.fast_scores enable row level security;

drop policy if exists "judges read own scores" on public.fast_scores;
create policy "judges read own scores" on public.fast_scores for select to authenticated
using (
  judge_id = auth.uid()
  or exists (select 1 from public.fests f
             join public.fast_events e on e.fest_id = f.id
             where e.id = event_id and f.owner_id = auth.uid())
);

drop policy if exists "judges write own scores" on public.fast_scores;
create policy "judges write own scores" on public.fast_scores for insert to authenticated
with check (
  judge_id = auth.uid()
  and exists (select 1 from public.fast_event_judges j
              where j.event_id = event_id and j.judge_id = auth.uid() and j.is_active)
);

drop policy if exists "judges update own scores" on public.fast_scores;
create policy "judges update own scores" on public.fast_scores for update to authenticated
using (judge_id = auth.uid()) with check (judge_id = auth.uid());

-- Submission counts WITHOUT exposing values (what judge clients may call).
create or replace function public.fast_submission_counts(p_event uuid)
returns table (entry_id uuid, submitted int)
language sql stable security definer set search_path = public as $$
  select s.entry_id, count(*)::int
  from public.fast_scores s
  where s.event_id = p_event
  group by s.entry_id;
$$;
revoke all on function public.fast_submission_counts(uuid) from public;
grant execute on function public.fast_submission_counts(uuid) to authenticated;

-- ============================================================================
-- REALTIME: delays + reschedules push instantly to every subscribed device.
-- ============================================================================
alter table public.fast_schedule_cells replica identity full;
alter table public.fast_scores replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.fast_schedule_cells;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.fast_scores;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PORTS — same model in other ORMs (reference only)
-- ----------------------------------------------------------------------------
-- Prisma:
--   model FastEvent  { id String @id @default(uuid())  festId String
--     venueId String?  name String  scoringMethod String @default("auto")
--     judges FastEventJudge[]  entries FastEntry[]  cells FastScheduleCell[] }
--   model FastEventJudge { eventId String  judgeId String  isActive Boolean @default(true)
--     @@id([eventId, judgeId]) }                      // <-- N judges, no limit
--   model FastEntry  { id String @id @default(uuid())  eventId String
--     codeLetter String?  memberIds String[]  scores FastScore[] }
--   model FastScore  { entryId String  judgeId String  eventId String
--     mark Decimal @db.Decimal(5,2)  @@id([entryId, judgeId]) }  // one row per judge
--   model FastScheduleCell { id String @id @default(uuid())  festId String
--     eventId String  venueId String  day DateTime @db.Date
--     startsAt DateTime  endsAt DateTime  delayMinutes Int @default(0) }
--   model FastBookmark { userId String  eventId String  @@id([userId, eventId]) }
--
-- Mongoose (dynamic arrays — judges scale freely):
--   const FastEvent = model('FastEvent', new Schema({
--     festId: ObjectId, venueId: ObjectId, name: String,
--     scoringMethod: { type: String, enum: ['average','trimmed','auto'], default: 'auto' },
--     judgeIds: [{ type: ObjectId, ref: 'User' }],   // <-- dynamic array, 2..N
--     status: { type: Number, default: -1 },
--   }));
--   const FastScore = model('FastScore', new Schema({
--     entryId: ObjectId, eventId: ObjectId, judgeId: ObjectId,
--     mark: { type: Number, min: 0, max: 100 },
--   }, { timestamps: true }));
--   FastScore.index({ entryId: 1, judgeId: 1 }, { unique: true });
-- ============================================================================
