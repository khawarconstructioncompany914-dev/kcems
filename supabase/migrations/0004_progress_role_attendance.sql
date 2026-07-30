-- ============================================================
-- KCEMS · 0004 — site dates + progress tracking, attendance + leave
--
-- Safe to re-run: IF NOT EXISTS / OR REPLACE throughout.
--
-- Note there is no role rename in here. Engineer -> Head Engineer and
-- Supervisor -> Site Engineer is display-only: role_t keeps its 'engineer' and
-- 'supervisor' values, so every RLS policy, function and role check below and
-- elsewhere keeps working untouched. Only the words on screen change.
-- ============================================================

-- ---------- site dates ----------
alter table site add column if not exists start_date         date;
alter table site add column if not exists target_finish_date date;

-- ---------- progress log ----------
-- Append-only, same shape as expense_photo: the current value is simply the
-- most recent row. No approval flow, no mutable "current pct" column to drift.
create table if not exists site_progress (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references site(id) on delete cascade,
  pct         smallint not null check (pct between 0 and 100),
  note        text,
  logged_by   uuid not null references app_user(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_site_progress_site on site_progress(site_id, created_at desc);

-- ---------- attendance + leave ----------
do $$ begin
  create type attendance_kind_t   as enum ('present', 'leave');
exception when duplicate_object then null; end $$;
do $$ begin
  create type attendance_status_t as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- One shared table for both kinds: the monthly grid wants "everything for this
-- month" in a single pass regardless of kind. `status` only carries meaning on
-- kind='leave' — present rows are inserted approved and never revisited.
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_user(id) on delete cascade,
  date        date not null,
  kind        attendance_kind_t not null,
  status      attendance_status_t not null default 'approved',
  marked_at   timestamptz not null default now(),
  lat         double precision,
  lng         double precision,
  note        text,
  reviewed_by uuid references app_user(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, date)          -- one mark per person per day
);
create index if not exists idx_attendance_date on attendance(date);
create index if not exists idx_attendance_user on attendance(user_id, date desc);

-- Same posture as every other table: service-role only, no anon policies. The
-- API is the gate; this is the backstop.
alter table site_progress enable row level security;
alter table attendance    enable row level security;

-- ============================================================
-- Functions
-- ============================================================

-- A progress update is a single insert with nothing to keep atomic, so unlike
-- kcems_log_expense it does not need a function of its own — but having one
-- keeps the audit row next to the insert instead of trusting each caller to
-- remember it.
create or replace function kcems_log_progress(
  p_site uuid, p_pct smallint, p_note text, p_actor uuid
) returns site_progress language plpgsql as $$
declare r site_progress;
begin
  insert into site_progress (site_id, pct, note, logged_by)
  values (p_site, p_pct, nullif(trim(coalesce(p_note,'')), ''), p_actor)
  returning * into r;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'site.progress', 'site', p_site, jsonb_build_object('pct', p_pct));
  return r;
end $$;

-- One mark per person per day. 'present' is approved on insert — it is a
-- statement of fact, not a request. 'leave' lands pending and ignores any
-- coordinates, since there is no location to record for a day off.
--
-- The unique(user_id, date) constraint is the real guard against double
-- marking; it is translated to a friendly error here so the API can pass
-- something readable to the person rather than a raw constraint name.
create or replace function kcems_mark_attendance(
  p_user uuid, p_date date, p_kind attendance_kind_t,
  p_lat double precision, p_lng double precision, p_note text
) returns attendance language plpgsql as $$
declare a attendance;
begin
  insert into attendance (user_id, date, kind, status, lat, lng, note)
  values (
    p_user, p_date, p_kind,
    case when p_kind = 'present' then 'approved'::attendance_status_t
         else 'pending'::attendance_status_t end,
    case when p_kind = 'present' then p_lat else null end,
    case when p_kind = 'present' then p_lng else null end,
    nullif(trim(coalesce(p_note,'')), '')
  )
  returning * into a;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_user, 'attendance.mark', 'attendance', a.id,
          jsonb_build_object('kind', p_kind, 'date', p_date, 'status', a.status));
  return a;
exception when unique_violation then
  raise exception 'already marked for this date';
end $$;

-- Owner/Admin decide on a leave request. Guarded to rows that are actually
-- pending leave, so a present mark can never be "rejected" and an already
-- decided request cannot be silently flipped.
create or replace function kcems_review_leave(
  p_attendance uuid, p_approve boolean, p_reviewer uuid
) returns attendance language plpgsql as $$
declare a attendance;
begin
  update attendance
     set status      = case when p_approve then 'approved'::attendance_status_t
                            else 'rejected'::attendance_status_t end,
         reviewed_by = p_reviewer,
         reviewed_at = now()
   where id = p_attendance and kind = 'leave' and status = 'pending'
  returning * into a;
  if a.id is null then raise exception 'not a pending leave request'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_reviewer, 'attendance.review', 'attendance', a.id,
          jsonb_build_object('status', 'pending'),
          jsonb_build_object('status', a.status));
  return a;
end $$;
