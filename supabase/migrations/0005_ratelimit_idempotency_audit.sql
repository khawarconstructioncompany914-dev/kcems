-- ============================================================
-- KCEMS · 0005 — login rate limiting, idempotent replay, audit reads
--
-- Safe to re-run: IF NOT EXISTS / OR REPLACE throughout.
--
-- Three unrelated-looking things land together because they are all the cost
-- of running this app in the open rather than as a prototype:
--   1. login_attempt   — /api/login had no throttle at all, and the roster's
--                        username scheme is public in this repository.
--   2. client_action   — the field app now queues writes made with no signal
--                        and replays them later, so the same submission can
--                        legitimately arrive twice and must only count once.
--   3. audit_log index — the rows were being written since 0001 and never read.
-- ============================================================

-- ============================================================
-- 1. Login rate limiting
-- ============================================================
-- Attempts are keyed on what was TYPED, not on the account that was matched:
-- login is deliberately fuzzy (see src/data/match.js), so an attacker probing
-- "muhammad" hits eight accounts and would otherwise dodge a per-account
-- counter entirely.
create table if not exists login_attempt (
  id          bigserial primary key,
  identifier  text not null,
  ip          text,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_attempt_ident on login_attempt(identifier, created_at desc);
create index if not exists idx_login_attempt_ip    on login_attempt(ip, created_at desc) where ip is not null;

alter table login_attempt enable row level security;

-- How long this caller must wait, in seconds. 0 means "go ahead".
--
-- Two independent ceilings. The per-identifier one stops someone grinding a
-- single name; the per-IP one stops them walking the roster instead. The IP
-- limit is deliberately loose — a site office behind one NAT is a genuine
-- shared address, and locking out a whole office is worse than the attack.
create or replace function kcems_login_retry_after(p_identifier text, p_ip text)
returns integer language plpgsql as $$
declare
  v_ident_fails int;
  v_ip_fails    int;
  v_last        timestamptz;
  v_window      interval := interval '15 minutes';
begin
  select count(*), max(created_at) into v_ident_fails, v_last
    from login_attempt
   where identifier = p_identifier and not ok and created_at > now() - v_window;

  if v_ident_fails >= 8 then
    return greatest(1, ceil(extract(epoch from (v_last + v_window - now())))::int);
  end if;

  if p_ip is not null then
    select count(*), max(created_at) into v_ip_fails, v_last
      from login_attempt
     where ip = p_ip and not ok and created_at > now() - v_window;
    if v_ip_fails >= 50 then
      return greatest(1, ceil(extract(epoch from (v_last + v_window - now())))::int);
    end if;
  end if;

  return 0;
end $$;

-- Records the attempt. A success clears that identifier's failures, so somebody
-- who simply mistyped their password four times is not still half-locked an
-- hour later. Old rows are pruned opportunistically rather than by a cron job:
-- this table has no value beyond its window and nobody should have to remember
-- to sweep it.
create or replace function kcems_record_login(p_identifier text, p_ip text, p_ok boolean)
returns void language plpgsql as $$
begin
  insert into login_attempt (identifier, ip, ok) values (p_identifier, p_ip, p_ok);
  if p_ok then
    delete from login_attempt where identifier = p_identifier and not ok;
  end if;
  if random() < 0.02 then
    delete from login_attempt where created_at < now() - interval '2 days';
  end if;
end $$;

-- ============================================================
-- 2. Idempotent replay for queued offline writes
-- ============================================================
-- The phone stamps every queued write with a client_ref and keeps it across
-- retries. Claiming the ref here — before the work is done — is what makes a
-- replay safe: the second arrival loses the insert race and is told the write
-- already happened, instead of filing a second expense for the same bill.
--
-- The claim is released by the API if the action then fails, so a genuine retry
-- after a server error still goes through.
create table if not exists client_action (
  client_ref  text primary key,
  user_id     uuid not null references app_user(id) on delete cascade,
  action      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_client_action_created on client_action(created_at);

alter table client_action enable row level security;

-- Returns true when the caller has just claimed this ref (so: do the work).
-- False means somebody already did it.
create or replace function kcems_claim_client_ref(p_ref text, p_user uuid, p_action text)
returns boolean language plpgsql as $$
declare v_rows int;
begin
  insert into client_action (client_ref, user_id, action)
  values (p_ref, p_user, p_action)
  on conflict (client_ref) do nothing;

  get diagnostics v_rows = row_count;

  if random() < 0.01 then
    delete from client_action where created_at < now() - interval '30 days';
  end if;

  return v_rows > 0;
end $$;

create or replace function kcems_release_client_ref(p_ref text)
returns void language sql as $$
  delete from client_action where client_ref = p_ref;
$$;

-- ============================================================
-- 3. Audit log reads
-- ============================================================
-- Written to by every state-machine function since 0001; nothing ever read it
-- back. The activity view pages newest-first.
create index if not exists idx_audit_log_created on audit_log(created_at desc);
