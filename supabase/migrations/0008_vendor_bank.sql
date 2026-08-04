-- ============================================================
-- KCEMS · 0008 — vendor & bank ledger module
--
-- Digitizes the paper sub-contractor agreement and its running payment ledger.
-- No approval state machine: admin owns vendors and bills, finance owns
-- accounts and the ledger, both record directly. Audit-logged throughout.
-- Safe to re-run.
--
-- The one thing the paper form cannot do is subtract. Its balance column is
-- crossed out and rewritten in red pen every time a payment lands. Here the
-- balance is a view over the payments, so it cannot disagree with them.
-- ============================================================

-- ---------- enums ----------
-- One block per type, deliberately. A single block wrapping all four would
-- abort at the FIRST duplicate and silently skip the rest — so a database that
-- already had vendor_status_t would never get the other three. Matches 0004.
do $$ begin
  create type vendor_status_t       as enum ('active','inactive');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vendor_bill_status_t  as enum ('open','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type bank_account_status_t as enum ('active','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type bank_txn_type_t       as enum ('cash_in','cash_out');
exception when duplicate_object then null; end $$;
-- Purpose is a fixed set so the ledger can be totalled by category later;
-- 'other' plus the free-text note is the escape hatch for anything that does
-- not fit, so a new kind of payment never blocks Tariq at the point of entry.
do $$ begin
  create type bank_purpose_t        as enum ('vendor_payment','owner_deposit','withdrawal','salary','other');
exception when duplicate_object then null; end $$;

-- ---------- vendor categories (admin-managed, not a fixed enum) ----------
create table if not exists vendor_category (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_by  uuid references app_user(id),
  created_at  timestamptz not null default now()
);

-- ---------- vendors ----------
create table if not exists vendor (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category_id    uuid references vendor_category(id),
  contact_name   text,
  contact_phone  text,
  status         vendor_status_t not null default 'active',
  created_by     uuid references app_user(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_vendor_category on vendor(category_id);

-- ---------- which vendors are deployed to which sites (many-to-many) ----------
create table if not exists site_vendor (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references site(id) on delete cascade,
  vendor_id    uuid not null references vendor(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  unique (site_id, vendor_id)
);
create index if not exists idx_site_vendor_site   on site_vendor(site_id);
create index if not exists idx_site_vendor_vendor on site_vendor(vendor_id);

-- ---------- vendor bills (the contract + rate terms) ----------
create table if not exists vendor_bill (
  id                 uuid primary key default gen_random_uuid(),
  vendor_id          uuid not null references vendor(id),
  site_id            uuid not null references site(id),
  category_id        uuid references vendor_category(id),
  title              text not null,
  contracted_amount  bigint not null check (contracted_amount > 0),
  rate_note          text,
  start_date         date,
  status             vendor_bill_status_t not null default 'open',
  created_by         uuid references app_user(id),
  created_at         timestamptz not null default now()
);
create index if not exists idx_vendor_bill_vendor on vendor_bill(vendor_id);
create index if not exists idx_vendor_bill_site   on vendor_bill(site_id);
create index if not exists idx_vendor_bill_status on vendor_bill(status);

-- ---------- photos of the paper agreement / stamps / signatures ----------
-- Same shape as expense_photo / fund_txn_photo, and reuses the existing private
-- "bills" bucket under a vendor/ prefix rather than adding another one.
create table if not exists vendor_bill_photo (
  id             uuid primary key default gen_random_uuid(),
  vendor_bill_id uuid not null references vendor_bill(id) on delete cascade,
  storage_path   text not null,
  captured_at    timestamptz not null default now(),
  uploaded_by    uuid references app_user(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_vendor_bill_photo_bill on vendor_bill_photo(vendor_bill_id);

-- ---------- bank accounts ----------
create table if not exists bank_account (
  id               uuid primary key default gen_random_uuid(),
  bank_name        text not null,
  account_title    text not null,
  account_number   text not null,
  branch           text,
  address          text,
  opening_balance  bigint not null default 0,
  status           bank_account_status_t not null default 'active',
  created_by       uuid references app_user(id),
  created_at       timestamptz not null default now()
);

-- ---------- bank ledger ----------
-- vendor_bill_id is nullable: a payment against a specific bill is the common
-- case, but an owner deposit or a plain withdrawal has no vendor attached.
create table if not exists bank_txn (
  id               uuid primary key default gen_random_uuid(),
  bank_account_id  uuid not null references bank_account(id),
  vendor_bill_id   uuid references vendor_bill(id),
  type             bank_txn_type_t not null,
  purpose          bank_purpose_t not null default 'other',
  amount           bigint not null check (amount > 0),
  note             text,
  by_user_id       uuid not null references app_user(id),
  created_at       timestamptz not null default now()
);
create index if not exists idx_bank_txn_account on bank_txn(bank_account_id);
create index if not exists idx_bank_txn_bill    on bank_txn(vendor_bill_id);

-- ============================================================
-- Derived views — compute, never store
--
-- security_invoker is not optional here: without it a view runs as its OWNER
-- and sees past the row level security below. That is exactly the CRITICAL
-- finding 0007 had to go back and fix on the first two views.
-- ============================================================

-- A bill's balance counts cash_out against it, less any cash_in booked back
-- against the same bill — a refund or a correcting entry has to reduce what the
-- vendor has been paid, or the balance drifts from reality.
create or replace view v_vendor_bill_balance with (security_invoker = on) as
select
  vb.id as vendor_bill_id,
  vb.contracted_amount,
  coalesce((select sum(case when t.type = 'cash_out' then t.amount else -t.amount end)
              from bank_txn t where t.vendor_bill_id = vb.id), 0) as paid,
  vb.contracted_amount
    - coalesce((select sum(case when t.type = 'cash_out' then t.amount else -t.amount end)
                  from bank_txn t where t.vendor_bill_id = vb.id), 0) as balance
from vendor_bill vb;

create or replace view v_bank_account_balance with (security_invoker = on) as
select
  a.id as bank_account_id,
  a.opening_balance,
  coalesce((select sum(t.amount) from bank_txn t
             where t.bank_account_id = a.id and t.type = 'cash_in'), 0)  as cash_in,
  coalesce((select sum(t.amount) from bank_txn t
             where t.bank_account_id = a.id and t.type = 'cash_out'), 0) as cash_out,
  a.opening_balance
    + coalesce((select sum(t.amount) from bank_txn t
                 where t.bank_account_id = a.id and t.type = 'cash_in'), 0)
    - coalesce((select sum(t.amount) from bank_txn t
                 where t.bank_account_id = a.id and t.type = 'cash_out'), 0) as closing_balance
from bank_account a;

-- ============================================================
-- Row Level Security + grants
-- Same posture as every other table: service-role only, no anon policies. The
-- revokes mirror 0007 — the default privileges revoke there already covers
-- tables created afterwards, but saying it here means this migration is
-- correct on its own rather than only in sequence.
-- ============================================================
alter table vendor_category   enable row level security;
alter table vendor            enable row level security;
alter table site_vendor       enable row level security;
alter table vendor_bill       enable row level security;
alter table vendor_bill_photo enable row level security;
alter table bank_account      enable row level security;
alter table bank_txn          enable row level security;

revoke all on vendor_category, vendor, site_vendor, vendor_bill,
              vendor_bill_photo, bank_account, bank_txn,
              v_vendor_bill_balance, v_bank_account_balance
  from anon, authenticated;

-- ============================================================
-- Functions — do the write, log it, return the row. Same shape as
-- kcems_add_funds. search_path is pinned on each: 0007 swept the functions
-- that existed when it ran, and cannot reach ones created afterwards.
-- ============================================================

create or replace function kcems_create_vendor_category(p_actor uuid, p_name text)
returns vendor_category language plpgsql set search_path = public, pg_temp as $$
declare c vendor_category;
begin
  insert into vendor_category (name, created_by) values (p_name, p_actor) returning * into c;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'vendor_category.create', 'vendor_category', c.id, jsonb_build_object('name', p_name));
  return c;
end $$;

create or replace function kcems_create_vendor(
  p_actor uuid, p_name text, p_category uuid, p_contact_name text, p_contact_phone text
) returns vendor language plpgsql set search_path = public, pg_temp as $$
declare v vendor;
begin
  insert into vendor (name, category_id, contact_name, contact_phone, created_by)
  values (p_name, p_category, p_contact_name, p_contact_phone, p_actor) returning * into v;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'vendor.create', 'vendor', v.id, jsonb_build_object('name', p_name, 'category_id', p_category));
  return v;
end $$;

create or replace function kcems_update_vendor(
  p_actor uuid, p_vendor uuid, p_name text, p_category uuid,
  p_contact_name text, p_contact_phone text, p_status vendor_status_t
) returns vendor language plpgsql set search_path = public, pg_temp as $$
declare v vendor; before_row vendor;
begin
  select * into before_row from vendor where id = p_vendor;
  if before_row.id is null then raise exception 'no such vendor'; end if;
  update vendor set
    name          = coalesce(p_name, name),
    category_id   = coalesce(p_category, category_id),
    contact_name  = coalesce(p_contact_name, contact_name),
    contact_phone = coalesce(p_contact_phone, contact_phone),
    status        = coalesce(p_status, status)
  where id = p_vendor returning * into v;
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_actor, 'vendor.update', 'vendor', v.id, to_jsonb(before_row), to_jsonb(v));
  return v;
end $$;

create or replace function kcems_assign_vendor_site(p_actor uuid, p_vendor uuid, p_site uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into site_vendor (site_id, vendor_id) values (p_site, p_vendor)
  on conflict (site_id, vendor_id) do nothing
  returning id into v_id;
  -- Nothing to log if the vendor was already on the site: an audit row for a
  -- change that did not happen is noise in the trail.
  if v_id is null then return; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'vendor.assign_site', 'site_vendor', v_id,
          jsonb_build_object('vendor_id', p_vendor, 'site_id', p_site));
end $$;

create or replace function kcems_unassign_vendor_site(p_actor uuid, p_vendor uuid, p_site uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  delete from site_vendor where site_id = p_site and vendor_id = p_vendor returning id into v_id;
  if v_id is null then return; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'vendor.unassign_site', 'site_vendor', v_id,
          jsonb_build_object('vendor_id', p_vendor, 'site_id', p_site));
end $$;

create or replace function kcems_create_vendor_bill(
  p_actor uuid, p_vendor uuid, p_site uuid, p_category uuid,
  p_title text, p_amount bigint, p_rate_note text, p_start_date date
) returns vendor_bill language plpgsql set search_path = public, pg_temp as $$
declare b vendor_bill;
begin
  insert into vendor_bill (vendor_id, site_id, category_id, title, contracted_amount, rate_note, start_date, created_by)
  values (p_vendor, p_site, p_category, p_title, p_amount,
          nullif(trim(coalesce(p_rate_note, '')), ''), p_start_date, p_actor)
  returning * into b;
  -- A bill implies the vendor is working that site, so record the deployment
  -- rather than making somebody remember to do it separately.
  insert into site_vendor (site_id, vendor_id) values (p_site, p_vendor)
  on conflict (site_id, vendor_id) do nothing;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'vendor_bill.create', 'vendor_bill', b.id,
          jsonb_build_object('vendor_id', p_vendor, 'site_id', p_site, 'contracted_amount', p_amount));
  return b;
end $$;

-- Closing is a label, not a lock: a final settlement after closing is normal,
-- and refusing it would only push the payment somewhere untracked.
create or replace function kcems_set_vendor_bill_status(
  p_actor uuid, p_bill uuid, p_status vendor_bill_status_t
) returns void language plpgsql set search_path = public, pg_temp as $$
declare v_before vendor_bill_status_t;
begin
  select status into v_before from vendor_bill where id = p_bill;
  if v_before is null then raise exception 'no such bill'; end if;
  if v_before = p_status then return; end if;
  update vendor_bill set status = p_status where id = p_bill;
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_actor, 'vendor_bill.' || p_status::text, 'vendor_bill', p_bill,
          jsonb_build_object('status', v_before), jsonb_build_object('status', p_status));
end $$;

create or replace function kcems_create_bank_account(
  p_actor uuid, p_bank_name text, p_title text, p_account_number text,
  p_branch text, p_address text, p_opening_balance bigint
) returns bank_account language plpgsql set search_path = public, pg_temp as $$
declare a bank_account;
begin
  insert into bank_account (bank_name, account_title, account_number, branch, address, opening_balance, created_by)
  values (p_bank_name, p_title, p_account_number, p_branch, p_address, coalesce(p_opening_balance, 0), p_actor)
  returning * into a;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'bank_account.create', 'bank_account', a.id,
          jsonb_build_object('bank_name', p_bank_name, 'account_title', p_title));
  return a;
end $$;

-- One function for both directions — p_type decides cash_in vs cash_out.
create or replace function kcems_bank_txn(
  p_actor uuid, p_account uuid, p_type bank_txn_type_t, p_amount bigint,
  p_purpose bank_purpose_t, p_vendor_bill uuid, p_note text
) returns bank_txn language plpgsql set search_path = public, pg_temp as $$
declare t bank_txn;
begin
  -- A bill belongs to one site and one vendor; paying it from a transaction
  -- that names a different account is fine, but pointing at a bill that does
  -- not exist is not, and the FK would say so in a less readable way.
  if p_vendor_bill is not null and not exists (select 1 from vendor_bill where id = p_vendor_bill) then
    raise exception 'no such vendor bill';
  end if;
  insert into bank_txn (bank_account_id, vendor_bill_id, type, purpose, amount, note, by_user_id)
  values (p_account, p_vendor_bill, p_type, coalesce(p_purpose, 'other'), p_amount,
          nullif(trim(coalesce(p_note, '')), ''), p_actor)
  returning * into t;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'bank_txn.' || p_type::text, 'bank_txn', t.id,
          jsonb_build_object('amount', p_amount, 'purpose', t.purpose,
                             'bank_account_id', p_account, 'vendor_bill_id', p_vendor_bill));
  return t;
end $$;
