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
   - `supabase/migrations/0004_progress_role_attendance.sql`
   - `supabase/migrations/0005_ratelimit_idempotency_audit.sql`
   - `supabase/migrations/0006_attendance_leave_ranges.sql`
   This creates the tables, the balance/site views, the approval functions, the
   multi-photo tables and reimbursement claims, site progress tracking,
   attendance and multi-day leave, login rate limiting, the replay guard the
   offline queue depends on, and the private **`bills`** storage bucket for
   receipt photos.
3. **Project Settings → API** — copy the `Project URL`, the `anon` key, and the
   `service_role` key. (Keep `service_role` secret — it goes into Vercel, step 3.)
4. **Project Settings → Database** — copy **both** connection strings. They are
   not interchangeable and you need each of them:
   - **Connection pooling** URI, port 6543 → `POSTGRES_URL` (what the app uses)
   - **Connection string** URI, port 5432 → `POSTGRES_URL_NON_POOLING` (what
     `pg_dump`, `pg_restore` and the scripts use; the pooler cannot do those)
5. Create the first **Owner** login. In SQL Editor:
   ```sql
   insert into app_user (name, username, role, password_hash, must_change_password)
   values ('Meesam Ali', 'meesamali', 'owner',
           crypt('CHANGE_ME_TEMP', gen_salt('bf')), true);
   ```
   (Owner then creates everyone else in-app under **Users & access**.)

> **Pick a region near Pakistan.** Supabase cannot move a project between
> regions afterwards — you have to create a new one and migrate into it
> (docs/OPERATIONS.md §3). Singapore is roughly a fifth of the round-trip time
> of the US East regions from Pakistan.

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

   | Variable | Value |
   |---|---|
   | `POSTGRES_URL` | pooler URI, port **6543** |
   | `POSTGRES_URL_NON_POOLING` | direct URI, port **5432** |
   | `SUPABASE_URL` | project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
   | `JWT_SECRET` | any long random string — changing it signs everyone out |
   | `VITE_SUPABASE_URL` | project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon key |
   | `VITE_DATA_SOURCE` | `supabase` |

   `POSTGRES_URL` is the one people miss. Without it the site builds and
   deploys perfectly and then every single API call fails.

   The `VITE_*` values are read at **build** time, so changing any of them means
   a redeploy — an existing deployment will not pick them up.

3. **Deploy.** You get a free `https://kcems-xxxx.vercel.app` address — that's what the
   office and supervisors open. (A custom domain can be added later.)

## Step 4 — backups

Supabase's free tier takes none. `.github/workflows/backup.yml` runs a nightly
encrypted dump and proves it restores. Add two repository secrets —
`SUPABASE_DB_URL` (the direct, port-5432 string) and `BACKUP_PASSPHRASE` — then
trigger it once by hand from the Actions tab to confirm it passes.

---

## Status

| Layer | State |
|---|---|
| React app (desktop + mobile PWA) | ✅ built & running |
| 5 roles, username/password, forced first-login change | ✅ built |
| Approval state machine + money logic | ✅ built, enforced server-side |
| Supabase schema, views, RPCs, storage bucket | ✅ applied |
| `/api` serverless layer + Supabase provider | ✅ built & live |
| Deployed to Vercel | ✅ live at kcems.vercel.app |
| Login rate limiting + audit trail on screen | ✅ built |
| Offline queue for field writes | ✅ built |
| CSV / Excel / PDF export | ✅ built |
| Nightly verified backups | ⚙️ needs the two repository secrets above |
| Database region | ⚠️ us-east-1 — see docs/OPERATIONS.md §3 |

Day-to-day operations — rotating passwords, restoring a backup, moving region —
are in **[docs/OPERATIONS.md](docs/OPERATIONS.md)**.
