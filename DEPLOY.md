# KCEMS — deployment & setup guide

Everything below uses **free** tiers: **GitHub** (code) + **Vercel** (app + API) +
**Supabase** (database, file storage). Total cost: **₨0/month**.

> You create the three accounts (they need your email/login — I can't).
> Secret keys go **only** into the Vercel/Supabase dashboards — never into chat or git.

---

## Architecture

```
 Phone / Desktop browser
        │  username + password
        ▼
  React PWA  ──►  Vercel serverless API (/api/*)  ──►  Supabase Postgres
 (Vercel CDN)      · verifies login (bcrypt + JWT)       · tables + views
                   · enforces role rules (§2)            · state-machine RPCs (§3)
                   · runs money transitions atomically   · Storage bucket "bills"
```

- **One app, two devices.** The desktop office app and the mobile field app are the
  same PWA. Supervisors open the address on their phone, log in, optionally
  "Add to Home Screen".
- **Login:** username + password, no OTP. Owner/Admin create accounts with a temp
  password; each user sets their own on first login. Passwords are stored as
  **bcrypt hashes** server-side.
- **Money follows the supervisor**, never the site — so re-assigning someone between
  sites/cities carries their cash and ledger with them.

---

## Step 1 — Supabase (database + photos)

1. Create a free account at supabase.com → **New project** (pick a region near
   Pakistan, e.g. Singapore). Save the database password it gives you.
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_photos_and_claims.sql`
   This creates the tables, the balance/site views, the approval functions, the
   multi-photo tables and engineer reimbursement claims, and the private
   **`bills`** storage bucket for receipt photos.
3. **Project Settings → API** — copy the `Project URL`, the `anon` key, and the
   `service_role` key. (Keep `service_role` secret — it goes into Vercel, step 3.)
4. Create the first **Owner** login. In SQL Editor:
   ```sql
   insert into app_user (name, username, role, password_hash, must_change_password)
   values ('Meesam Ali', 'meesamali', 'owner',
           crypt('CHANGE_ME_TEMP', gen_salt('bf')), true);
   ```
   (Owner then creates everyone else in-app under **Users & access**.)

## Step 2 — GitHub (code)

1. Create a repo (e.g. `kcems`).
2. Push this project to it:
   ```bash
   git init && git add . && git commit -m "KCEMS"
   git branch -M main
   git remote add origin https://github.com/<you>/kcems.git
   git push -u origin main
   ```

## Step 3 — Vercel (hosting)

1. Create a free account, **Add New → Project**, import the `kcems` repo.
   Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
2. **Settings → Environment Variables** — add (from `.env.example`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (any long random string),
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DATA_SOURCE=supabase`.
3. **Deploy.** You get a free `https://kcems-xxxx.vercel.app` address — that's what the
   office and supervisors open. (A custom domain can be added later.)

---

## What's still to wire (next build step)

The database blueprint, the app, auth, roles and the PWA are done. Once the Supabase
project above exists, the remaining work is the **`/api` serverless layer + the
Supabase data provider** that swaps the app from the in-browser demo (`VITE_DATA_SOURCE=local`)
to live data (`=supabase`). That part is fast but needs the live project to test
against — so it's the first thing to do after Step 1.

## Status page

| Layer | State |
|---|---|
| React app (desktop + mobile PWA) | ✅ built & running |
| 5 roles, username/password, forced first-login change | ✅ built |
| Approval state machine + money logic | ✅ built (local), ✅ SQL functions ready |
| Supabase schema, views, RPCs, storage bucket | ✅ SQL ready to run |
| `/api` serverless layer + Supabase provider | ⏳ next (needs live project) |
| Deployed to Vercel | ⏳ needs your accounts |
