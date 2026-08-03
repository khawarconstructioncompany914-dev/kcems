-- ============================================================
-- KCEMS · Supabase schema (Build Spec §1) + auth fields
-- Run in Supabase → SQL Editor, or via `supabase db push`.
-- All money is integer PKR. Timestamps are timestamptz (UTC).
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- case-insensitive usernames

-- ---------- enums ----------
do $$ begin
  create type role_t            as enum ('owner','admin','finance','engineer','supervisor');
  create type user_status_t     as enum ('active','invited','disabled');
  create type site_status_t     as enum ('active','on_hold','closed');
  create type expense_status_t  as enum ('engineer_review','finance_review','approved','rejected','returned','settled');
  create type expense_cat_t     as enum ('materials','labour','fuel','tea_food','other');
  create type fund_type_t       as enum ('funds_in','settlement');
  create type fund_method_t     as enum ('cash','cheque','online');
exception when duplicate_object then null; end $$;

-- ---------- sites ----------
create table if not exists site (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  label            text not null,
  city             text,
  phase            text,
  engineer_id      uuid,                         -- FK app_user (added below)
  budget           bigint not null default 0,    -- PKR
  status           site_status_t not null default 'active',
  -- opening (pre-digital) approved spend, so live totals match the paper ledger
  opening_materials bigint not null default 0,
  opening_labour    bigint not null default 0,
  opening_fuel      bigint not null default 0,
  opening_tea_food  bigint not null default 0,
  opening_other     bigint not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------- users (people who log in) ----------
create table if not exists app_user (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  username              citext unique not null,          -- login handle (no OTP)
  email                 text,
  phone                 text,
  role                  role_t not null,
  password_hash         text not null,                   -- bcrypt/argon2, set server-side
  must_change_password  boolean not null default true,   -- temp password → change on first login
  engineer_id           uuid references app_user(id),    -- supervisors → their head engineer
  site_id               uuid references site(id),        -- supervisor's current site
  status                user_status_t not null default 'active',
  created_at            timestamptz not null default now()
);

do $$ begin
  alter table site add constraint site_engineer_fk foreign key (engineer_id) references app_user(id);
exception when duplicate_object then null; end $$;

-- ---------- expenses (the central record; runs the state machine) ----------
create table if not exists expense (
  id             uuid primary key default gen_random_uuid(),
  supervisor_id  uuid not null references app_user(id),
  site_id        uuid not null references site(id),
  amount         bigint not null check (amount > 0),     -- PKR
  category       expense_cat_t not null,
  note           text not null,
  bill_image_url text,                                   -- required by policy in the API layer
  status         expense_status_t not null default 'engineer_review',
  reject_reason  text,                                   -- required when rejected → drives "owed"
  return_note    text,                                   -- engineer's note when sent back to fix
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz
);

-- ---------- fund transactions ----------
create table if not exists fund_txn (
  id               uuid primary key default gen_random_uuid(),
  supervisor_id    uuid not null references app_user(id),
  type             fund_type_t not null,
  method           fund_method_t not null default 'cash',
  amount           bigint not null check (amount > 0),
  proof_image_url  text,
  by_user_id       uuid not null references app_user(id),   -- owner or finance
  note             text,
  created_at       timestamptz not null default now()
);

-- ---------- audit log (append-only; never edit/delete) ----------
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references app_user(id),
  action      text not null,
  entity      text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_expense_status      on expense(status);
create index if not exists idx_expense_supervisor  on expense(supervisor_id);
create index if not exists idx_expense_site        on expense(site_id);
create index if not exists idx_fund_supervisor     on fund_txn(supervisor_id);
create index if not exists idx_user_engineer       on app_user(engineer_id);
create index if not exists idx_user_site           on app_user(site_id);

-- ============================================================
-- Derived views (Build Spec §1 — compute, never store)
-- ============================================================

-- cash-in-hand = Σ funds_in − Σ approved expenses ; owed = Σ rejected unsettled
--
-- security_invoker: without it a view runs as its OWNER and sees straight past
-- the row level security below, which would make every supervisor's cash
-- readable by any role granted select on it. Set here rather than only in 0007
-- because `create or replace view` resets view options — re-running this file
-- alone would otherwise quietly undo the fix.
create or replace view v_supervisor_balance with (security_invoker = on) as
select
  u.id as supervisor_id,
  coalesce((select sum(f.amount) from fund_txn f where f.supervisor_id = u.id and f.type = 'funds_in'), 0) as funded,
  coalesce((select sum(e.amount) from expense  e where e.supervisor_id = u.id and e.status = 'approved'), 0) as spent,
  coalesce((select sum(f.amount) from fund_txn f where f.supervisor_id = u.id and f.type = 'funds_in'), 0)
    - coalesce((select sum(e.amount) from expense e where e.supervisor_id = u.id and e.status = 'approved'), 0) as cash_in_hand,
  coalesce((select sum(e.amount) from expense e where e.supervisor_id = u.id and e.status = 'rejected' and e.settled_at is null), 0) as owed_back
from app_user u
where u.role = 'supervisor';

-- site spend = opening + live approved, per category
-- security_invoker — see the note on v_supervisor_balance above
create or replace view v_site_spend with (security_invoker = on) as
select
  s.id as site_id,
  s.budget,
  s.opening_materials + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.category='materials'),0) as materials,
  s.opening_labour    + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.category='labour'),0)    as labour,
  s.opening_fuel      + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.category='fuel'),0)      as fuel,
  s.opening_tea_food  + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.category='tea_food'),0)  as tea_food,
  s.opening_other     + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.category='other'),0)     as other
from site s;

-- ============================================================
-- Row Level Security
-- The Vercel serverless API talks to Supabase with the SERVICE ROLE
-- key and enforces role rules (§2) in code, so RLS is defense-in-depth.
-- Enable it and keep tables locked to service-role by default.
-- ============================================================
alter table app_user  enable row level security;
alter table site      enable row level security;
alter table expense   enable row level security;
alter table fund_txn  enable row level security;
alter table audit_log enable row level security;
-- (no anon/authenticated policies added → only the service role can read/write)

-- ============================================================
-- Storage: bucket for bill photos (also creatable in the dashboard)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('bills', 'bills', false)
on conflict (id) do nothing;
