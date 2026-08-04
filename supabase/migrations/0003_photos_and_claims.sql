-- ============================================================
-- KCEMS · 0003 — multi-photo bills/proofs + engineer reimbursement claims
--
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE, and the
-- backfill at the bottom is guarded by a NOT EXISTS so a second run is a
-- no-op rather than a duplicate.
--
-- Enum note: `alter type ... add value` is allowed inside a transaction on
-- PostgreSQL 12+ (Supabase is well past that), but the new value cannot be
-- USED until that transaction commits. Nothing below references 'travel' or
-- 'lodging', so running this whole file as one batch is fine.
-- ============================================================

-- ---------- bill photos (many per expense) ----------
create table if not exists expense_photo (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references expense(id) on delete cascade,
  storage_path  text not null,
  captured_at   timestamptz not null default now(),   -- when the photo was taken/attached
  uploaded_by   uuid references app_user(id),
  created_at    timestamptz not null default now()
);
create index if not exists idx_expense_photo_expense on expense_photo(expense_id);

-- ---------- funds proof photos (cheque / online screenshot / cash photo) ----------
create table if not exists fund_txn_photo (
  id            uuid primary key default gen_random_uuid(),
  fund_txn_id   uuid not null references fund_txn(id) on delete cascade,
  storage_path  text not null,
  captured_at   timestamptz not null default now(),
  uploaded_by   uuid references app_user(id),
  created_at    timestamptz not null default now()
);
create index if not exists idx_fund_txn_photo_txn on fund_txn_photo(fund_txn_id);

-- Same RLS posture as every other table: service-role only, no anon policies.
alter table expense_photo  enable row level security;
alter table fund_txn_photo enable row level security;

-- ---------- engineer reimbursement claims ----------
do $$ begin
  create type expense_kind_t as enum ('site_expense', 'reimbursement');
exception when duplicate_object then null; end $$;

alter table expense add column if not exists kind expense_kind_t not null default 'site_expense';

-- reimbursement claims have no site — relax the not-null constraint
alter table expense alter column site_id drop not null;

-- new categories for reimbursement claims (food reuses the existing 'tea_food')
alter type expense_cat_t add value if not exists 'travel';
alter type expense_cat_t add value if not exists 'lodging';

-- NOTE: `expense.supervisor_id` is reused as "whose expense this is" for engineer
-- claims too (an engineer's own app_user.id goes in that column) — no new column
-- needed. Renaming it is out of scope; just don't be thrown by the column name
-- when it holds an engineer id.

create index if not exists idx_expense_kind on expense(kind);

-- ---------- keep site spend scoped to real site expenses only ----------
-- A reimbursement has site_id = null so it would never match a site anyway, but
-- being explicit means the view stays correct if a claim ever gets a site.
-- security_invoker — see the note in 0001; `create or replace view` resets view
-- options, so this redefinition has to carry it too
create or replace view v_site_spend with (security_invoker = on) as
select
  s.id as site_id,
  s.budget,
  s.opening_materials + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.kind='site_expense' and e.category='materials'),0) as materials,
  s.opening_labour    + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.kind='site_expense' and e.category='labour'),0)    as labour,
  s.opening_fuel      + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.kind='site_expense' and e.category='fuel'),0)      as fuel,
  s.opening_tea_food  + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.kind='site_expense' and e.category='tea_food'),0)  as tea_food,
  s.opening_other     + coalesce((select sum(amount) from expense e where e.site_id = s.id and e.status='approved' and e.kind='site_expense' and e.category='other'),0)     as other
from site s;

-- v_supervisor_balance is deliberately untouched: it already filters to
-- role='supervisor', and an engineer's claim never touches cash-in-hand math.

-- ---------- backfill existing single photos ----------
-- Expenses logged before this migration carry one storage path in
-- bill_image_url. Copy it across so historical bills still render in the new
-- photo grid. 'bill' is the demo-seed marker, not a real object — skip it.
insert into expense_photo (expense_id, storage_path, captured_at, uploaded_by)
select e.id, e.bill_image_url, e.created_at, e.supervisor_id
  from expense e
 where e.bill_image_url is not null
   and e.bill_image_url <> 'bill'
   and not exists (select 1 from expense_photo p where p.expense_id = e.id);

-- fund_txn.proof_image_url exists in 0001 but nothing has ever written to it.
-- Backfill anyway so the column stops being a second source of truth.
insert into fund_txn_photo (fund_txn_id, storage_path, captured_at)
select f.id, f.proof_image_url, f.created_at
  from fund_txn f
 where f.proof_image_url is not null
   and f.proof_image_url <> 'bill'
   and not exists (select 1 from fund_txn_photo p where p.fund_txn_id = f.id);

-- ============================================================
-- State-machine function for engineer claims.
--
-- This lives in 0003 rather than alongside its siblings in 0002 because it
-- depends on expense_kind_t and on site_id being nullable — both created
-- above. Putting it in 0002 would break a from-scratch deploy, where 0002
-- runs before this file.
--
-- kcems_log_expense is deliberately NOT modified. The spec called for
-- dropping its p_bill parameter, but in Postgres `create or replace function`
-- with a different parameter list creates an OVERLOAD rather than replacing
-- the original, and dropping the old signature first leaves a window where
-- deployed code cannot log an expense at all. The API now passes null for
-- p_bill and writes photos to expense_photo instead, so bill_image_url simply
-- stops being populated — same outcome, no ordering hazard.
-- ============================================================

-- engineer files a reimbursement claim -> straight to finance_review
-- (no site, no cash-in-hand effect, skips the engineer-review stage because
-- the engineer is the claimant)
create or replace function kcems_log_reimbursement(
  p_claimant uuid, p_amount bigint, p_category expense_cat_t, p_note text
) returns expense language plpgsql as $$
declare e expense;
begin
  insert into expense (supervisor_id, site_id, amount, category, note, status, kind)
  values (p_claimant, null, p_amount, p_category, p_note, 'finance_review', 'reimbursement')
  returning * into e;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_claimant, 'expense.claim', 'expense', e.id,
          jsonb_build_object('amount', p_amount, 'status', 'finance_review', 'kind', 'reimbursement'));
  return e;
end $$;
