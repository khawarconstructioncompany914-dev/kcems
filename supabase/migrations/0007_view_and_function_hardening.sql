-- ============================================================
-- KCEMS · 0007 — close what Supabase's security advisor flags
--
-- Safe to re-run.
--
-- Three findings, and they are not equally serious.
--
-- 1. SECURITY DEFINER VIEW (critical) — v_supervisor_balance, v_site_spend
--
--    A Postgres view runs as its OWNER unless told otherwise. These two were
--    created by the migration runner, so they run as it, so they see straight
--    past the row level security on app_user / expense / fund_txn. And nothing
--    in 0001-0006 ever issued a GRANT, which means Supabase's defaults apply:
--    SELECT on everything in `public` is granted to `anon` and
--    `authenticated`.
--
--    Put together, anyone holding the anon key could read every supervisor's
--    funded / spent / cash-in-hand / owed totals and every site's budget and
--    spend, straight off the REST endpoint, with RLS doing nothing to stop it.
--
--    Today that key is not published anywhere — this app never uses it, every
--    request goes through the /api layer with a direct Postgres connection, and
--    the compiled bundle contains no Supabase URL or key at all. So this is
--    latent rather than live. But the anon key is *designed* to be publishable,
--    it is sitting in the Vercel environment, and .env.example already earmarks
--    it for direct bill-photo uploads. The first person to add a client-side
--    Supabase call would publish the whole ledger without knowing it.
--
--    Fixed twice over: security_invoker makes the views obey the caller's RLS,
--    and the grants are revoked so the anon and authenticated roles cannot
--    reach them at all. Either alone would do; the pair means a future
--    `grant select on all tables in schema public` cannot quietly undo it.
--
-- 2. FUNCTION SEARCH PATH MUTABLE (warning) — every kcems_* function
--
--    A function with no search_path of its own resolves unqualified names using
--    the caller's, so anyone who can create objects in a schema earlier on that
--    path can shadow a table or operator the function relies on. These are all
--    SECURITY INVOKER, so the payoff is smaller than the linter assumes, but
--    pinning the path costs nothing.
--
-- 3. EXTENSION IN PUBLIC (warning) — citext. Deliberately NOT changed here;
--    see the note at the bottom.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Views obey the caller's RLS, and stop being publicly readable
-- ------------------------------------------------------------
-- security_invoker needs Postgres 15+. Every current Supabase project is well
-- past that, but guard it so this migration cannot half-apply on an older one:
-- the revokes below matter more and must still run.
do $$
begin
  if current_setting('server_version_num')::int >= 150000 then
    execute 'alter view public.v_supervisor_balance set (security_invoker = on)';
    execute 'alter view public.v_site_spend        set (security_invoker = on)';
  else
    raise notice 'Postgres < 15: security_invoker unavailable, relying on the revokes below';
  end if;
end $$;

-- Nothing in this app talks to the database as anon or authenticated — the API
-- connects with the Postgres connection string and enforces the role rules in
-- code (Build Spec §2). So these roles need no access to anything, and the
-- views are where the absence of it matters most.
revoke all on public.v_supervisor_balance from anon, authenticated;
revoke all on public.v_site_spend        from anon, authenticated;

-- The base tables already have RLS with no policies, so these roles were
-- getting nothing from them. Revoking as well means a view or function added
-- later cannot accidentally become a way through.
revoke all on public.app_user        from anon, authenticated;
revoke all on public.site            from anon, authenticated;
revoke all on public.expense         from anon, authenticated;
revoke all on public.fund_txn        from anon, authenticated;
revoke all on public.audit_log       from anon, authenticated;
revoke all on public.expense_photo   from anon, authenticated;
revoke all on public.fund_txn_photo  from anon, authenticated;
revoke all on public.site_progress   from anon, authenticated;
revoke all on public.attendance      from anon, authenticated;
revoke all on public.login_attempt   from anon, authenticated;
revoke all on public.client_action   from anon, authenticated;

-- And stop the default from re-granting on anything added from here on.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ------------------------------------------------------------
-- 2. Pin every function's search_path
-- ------------------------------------------------------------
-- Done by loop rather than by listing signatures, so it covers all of them
-- however they were defined, stays correct if an argument type changes, and
-- picks up any kcems_* function added later that forgets to set its own.
--
-- pg_temp is last on purpose: leaving it off entirely breaks nothing here, but
-- naming it explicitly stops it being searched FIRST, which is the actual
-- attack — a temp table shadowing a real one.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'kcems\_%'
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. citext in public — left alone, on purpose
-- ------------------------------------------------------------
-- The advisor wants extensions out of `public`. citext is not decoration here:
-- app_user.username IS of type citext, which is what makes login handles
-- case-insensitive.
--
-- Relocating an extension whose type is in use on a live table is a bigger risk
-- than the warning it silences — and it buys little, because the lint is about
-- an attacker shadowing extension objects, which requires CREATE on public that
-- anon and authenticated do not have (and now have even less of, see above).
--
-- If it is ever moved, it belongs in the `extensions` schema Supabase already
-- puts on the default search_path, and it should be done on a restored copy of
-- the database first:
--     alter extension citext set schema extensions;
