-- ============================================================
-- KCEMS · 0006 — leave over a date range, booked in advance
--
-- Safe to re-run: IF NOT EXISTS / OR REPLACE throughout.
--
-- Until now leave was one row for one day, and only ever for TODAY — the API
-- passed current_date and there was no way to say "I am away next Thursday".
-- Which meant nobody told the office in advance, because the app gave them no
-- way to.
--
-- The storage shape does not change: still one attendance row per person per
-- day, so the month grid, the KPIs and the unique(user_id, date) guard all keep
-- working untouched. What is new is leave_group — the rows of one request share
-- it, so a three-day request is approved or rejected as one decision instead of
-- three, and is shown to the reviewer as one line.
-- ============================================================

alter table attendance add column if not exists leave_group uuid;
create index if not exists idx_attendance_leave_group on attendance(leave_group) where leave_group is not null;

-- Rows written before this migration are single-day requests. Giving each one a
-- group of its own means the group-based review below works for them too, and
-- nothing has to special-case "old leave".
update attendance set leave_group = id where kind = 'leave' and leave_group is null;

-- ------------------------------------------------------------
-- Request leave over a range
-- ------------------------------------------------------------
-- Returns the group id. Every day lands 'pending' — a request is not leave
-- until somebody approves it, which is the whole point of the queue.
--
-- Backdating is allowed up to a month, deliberately: "I was ill last Tuesday"
-- is a real thing people need to record, and it still has to be approved by
-- the office before it counts. Beyond a month it is bookkeeping, not attendance.
create or replace function kcems_request_leave(
  p_user uuid, p_from date, p_to date, p_note text
) returns uuid language plpgsql as $$
declare
  v_group uuid := gen_random_uuid();
  v_days  int;
  v_clash text;
begin
  if p_to < p_from then
    raise exception 'the last day is before the first day';
  end if;

  v_days := (p_to - p_from) + 1;
  if v_days > 31 then
    raise exception 'one request cannot cover more than 31 days';
  end if;
  if p_from < current_date - 31 then
    raise exception 'leave cannot be backdated more than a month';
  end if;

  -- Naming the clashing dates matters: "you already have a mark on 14 Aug, 15
  -- Aug" tells the person which days to drop from the request. A bare unique
  -- violation would leave them guessing which day of the five was the problem.
  select string_agg(to_char(a.date, 'DD Mon'), ', ' order by a.date)
    into v_clash
    from attendance a
   where a.user_id = p_user and a.date between p_from and p_to;

  if v_clash is not null then
    raise exception 'you already have a mark on %', v_clash;
  end if;

  insert into attendance (user_id, date, kind, status, note, leave_group)
  select p_user, d::date, 'leave', 'pending',
         nullif(trim(coalesce(p_note, '')), ''), v_group
    from generate_series(p_from, p_to, interval '1 day') as d;

  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_user, 'attendance.leave_request', 'attendance', v_group,
          jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days));

  return v_group;

-- The clash check above is a read, so two requests racing on the same day can
-- still both pass it and collide on unique(user_id, date). The constraint is
-- the real guard; this only turns it into something a person can read.
exception when unique_violation then
  raise exception 'one of those days was marked while you were choosing — check the dates and try again';
end $$;

-- ------------------------------------------------------------
-- Decide a whole request at once
-- ------------------------------------------------------------
-- Guarded to rows that are actually pending leave, so a present mark can never
-- be "rejected" and an already-decided request cannot be silently flipped —
-- the same guard the single-row version has always had, applied to the group.
create or replace function kcems_review_leave_group(
  p_group uuid, p_approve boolean, p_reviewer uuid
) returns integer language plpgsql as $$
declare v_n int;
begin
  update attendance
     set status      = case when p_approve then 'approved'::attendance_status_t
                            else 'rejected'::attendance_status_t end,
         reviewed_by = p_reviewer,
         reviewed_at = now()
   where leave_group = p_group and kind = 'leave' and status = 'pending';

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'no pending leave in that request';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_reviewer, 'attendance.review', 'attendance', p_group,
          jsonb_build_object('status', 'pending'),
          jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end,
                             'days', v_n));
  return v_n;
end $$;

-- ------------------------------------------------------------
-- Present marks are unchanged
-- ------------------------------------------------------------
-- kcems_mark_attendance still takes its date from the caller, and the API still
-- passes current_date and nothing else. Present is a statement about right now;
-- letting it be backdated would make the whole record worthless.
