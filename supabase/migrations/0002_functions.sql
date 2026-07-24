-- ============================================================
-- KCEMS · approval state-machine transitions (Build Spec §3)
-- Each function does the status change + an audit_log row atomically.
-- Money effects are derived by the views, so a status change is all
-- that's needed. Call these from the serverless API (service role);
-- the API still authorizes the actor against §2 first.
-- ============================================================

-- supervisor logs an expense -> engineer_review
create or replace function kcems_log_expense(
  p_supervisor uuid, p_site uuid, p_amount bigint,
  p_category expense_cat_t, p_note text, p_bill text
) returns expense language plpgsql as $$
declare e expense;
begin
  insert into expense (supervisor_id, site_id, amount, category, note, bill_image_url, status)
  values (p_supervisor, p_site, p_amount, p_category, p_note, p_bill, 'engineer_review')
  returning * into e;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_supervisor, 'expense.create', 'expense', e.id, jsonb_build_object('amount', p_amount, 'status', 'engineer_review'));
  return e;
end $$;

-- engineer passes up -> finance_review
create or replace function kcems_pass_up(p_expense uuid, p_actor uuid)
returns expense language plpgsql as $$
declare e expense;
begin
  update expense set status = 'finance_review'
   where id = p_expense and status = 'engineer_review' returning * into e;
  if e.id is null then raise exception 'expense not in engineer_review'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'expense.pass_up', 'expense', e.id, jsonb_build_object('status','finance_review'));
  return e;
end $$;

-- engineer returns to fix -> returned (note back to the supervisor's phone)
create or replace function kcems_return_expense(p_expense uuid, p_actor uuid, p_note text)
returns expense language plpgsql as $$
declare e expense;
begin
  update expense set status = 'returned', return_note = p_note
   where id = p_expense and status = 'engineer_review' returning * into e;
  if e.id is null then raise exception 'expense not in engineer_review'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'expense.return', 'expense', e.id, jsonb_build_object('status','returned','return_note',p_note));
  return e;
end $$;

-- finance/owner approves -> approved (cash deducts via the balance view)
create or replace function kcems_approve(p_expense uuid, p_actor uuid)
returns expense language plpgsql as $$
declare e expense;
begin
  update expense set status = 'approved', decided_at = now()
   where id = p_expense and status = 'finance_review' returning * into e;
  if e.id is null then raise exception 'expense not in finance_review'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'expense.approve', 'expense', e.id, jsonb_build_object('status','approved'));
  return e;
end $$;

-- reject (either review stage) -> rejected (reason required → becomes owed-back)
create or replace function kcems_reject(p_expense uuid, p_actor uuid, p_reason text)
returns expense language plpgsql as $$
declare e expense;
begin
  if coalesce(trim(p_reason),'') = '' then raise exception 'reject reason required'; end if;
  update expense set status = 'rejected', reject_reason = p_reason, decided_at = now()
   where id = p_expense and status in ('engineer_review','finance_review') returning * into e;
  if e.id is null then raise exception 'expense not in a review stage'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'expense.reject', 'expense', e.id, jsonb_build_object('status','rejected','reject_reason',p_reason));
  return e;
end $$;

-- settle a rejected/owed item -> records a settlement fund_txn + clears owed
create or replace function kcems_settle(p_expense uuid, p_actor uuid, p_method fund_method_t)
returns expense language plpgsql as $$
declare e expense;
begin
  update expense set status = 'settled', settled_at = now()
   where id = p_expense and status = 'rejected' and settled_at is null returning * into e;
  if e.id is null then raise exception 'expense not rejected/unsettled'; end if;
  insert into fund_txn (supervisor_id, type, method, amount, by_user_id, note)
  values (e.supervisor_id, 'settlement', p_method, e.amount, p_actor, 'Settled: ' || e.note);
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'expense.settle', 'expense', e.id, jsonb_build_object('status','settled'));
  return e;
end $$;

-- owner/finance adds funds to a supervisor
create or replace function kcems_add_funds(
  p_supervisor uuid, p_actor uuid, p_amount bigint, p_method fund_method_t, p_note text
) returns fund_txn language plpgsql as $$
declare f fund_txn;
begin
  insert into fund_txn (supervisor_id, type, method, amount, by_user_id, note)
  values (p_supervisor, 'funds_in', p_method, p_amount, p_actor, p_note) returning * into f;
  insert into audit_log (actor_id, action, entity, entity_id, after)
  values (p_actor, 'funds.add', 'fund_txn', f.id, jsonb_build_object('amount',p_amount,'supervisor_id',p_supervisor));
  return f;
end $$;

-- supervisor fixes a returned item and re-submits -> engineer_review
-- p_note / p_bill are optional corrections: pass null to leave the value as-is
-- (an engineer usually returns an item because the note or the bill photo was
-- unusable, so the supervisor needs a way to replace them on the way back in).
create or replace function kcems_resubmit(
  p_expense uuid, p_actor uuid, p_note text default null, p_bill text default null
) returns expense language plpgsql as $$
declare e expense;
begin
  update expense
     set status         = 'engineer_review',
         return_note    = null,
         note           = coalesce(p_note, note),
         bill_image_url = coalesce(p_bill, bill_image_url)
   where id = p_expense and status = 'returned' returning * into e;
  if e.id is null then raise exception 'expense not in returned state'; end if;
  insert into audit_log (actor_id, action, entity, entity_id, before, after)
  values (p_actor, 'expense.resubmit', 'expense', e.id,
          jsonb_build_object('status','returned'),
          jsonb_build_object('status','engineer_review'));
  return e;
end $$;
