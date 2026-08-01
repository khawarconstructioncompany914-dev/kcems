# KCEMS — operations runbook

Everything you have to do *to* the running system rather than *in* it: rotating
passwords, restoring a backup, and moving the database closer to Pakistan.

Every command below needs a Postgres connection string. Two different ones exist
and they are not interchangeable:

| Which | Port | Where to find it | Use it for |
|---|---|---|---|
| **Pooler** (transaction mode) | 6543 | Supabase → Project Settings → Database → Connection pooling | The app. This is `POSTGRES_URL` in Vercel. |
| **Direct** | 5432 | Supabase → Project Settings → Database → Connection string → URI | `pg_dump`, `pg_restore`, `psql`, and the scripts here. |

`pg_dump` **cannot** run through the pooler. If a dump hangs or errors oddly,
check you are on port 5432.

---

## 1. Rotating everyone's password

Do this now if the database was ever seeded by an older version of
`/api/setup`, which wrote a password that is published in this repository.

```bash
export POSTGRES_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'
node scripts/rotate-passwords.js
```

That is a dry run and prints who would be affected. When you are ready — and
have somewhere to write the list down:

```bash
node scripts/rotate-passwords.js --apply --out temp-passwords.txt
```

Every account gets a fresh word-based password (`copper-lantern-quartz-47`) and
is forced to choose their own at first login. **Everyone is locked out until you
tell them their new one**, so do this at a time when you can hand them out.

Delete `temp-passwords.txt` once everyone has signed in. It is already covered
by `.gitignore`, but it holds live credentials — do not leave it lying around.

To rotate only some people:

```bash
node scripts/rotate-passwords.js --apply --only faraz,saqib
```

---

## 2. Backups

`.github/workflows/backup.yml` runs nightly at 02:00 PKT. It dumps the database,
**restores that dump into a throwaway Postgres to prove it works**, encrypts it,
and keeps it as a workflow artifact for 90 days.

It needs two repository secrets — Settings → Secrets and variables → Actions:

- `SUPABASE_DB_URL` — the **direct** (port 5432) connection string
- `BACKUP_PASSPHRASE` — a long random string

> Keep `BACKUP_PASSPHRASE` somewhere that is neither this repository nor this
> GitHub account. A backup you cannot decrypt is not a backup.

The dump is encrypted because this repository is public and **artifacts on a
public repository can be downloaded by anyone who finds the run**. If you make
the repository private, encryption is still worth keeping.

### Restoring

1. Actions → **Database backup** → open the run you want → download the artifact.
2. Decrypt:

   ```bash
   gpg --batch --decrypt --passphrase "$BACKUP_PASSPHRASE" \
       --output kcems.dump kcems-2026-08-01T2100.dump.gpg
   ```

3. Restore into the target project:

   ```bash
   pg_restore --dbname "$POSTGRES_URL_DIRECT" --no-owner --no-privileges \
              --clean --if-exists kcems.dump
   ```

   `--clean --if-exists` drops what is there first. On a project that already
   holds live data, that is destructive — restore into a **new** project instead
   and repoint Vercel once you have checked it.

Some errors about roles and extensions are normal: the dump carries Supabase's
own objects, which already exist (or cannot exist) on the target. What matters
is that the tables and their rows come back — the workflow checks exactly that
every night.

### What the backup does *not* cover

Bill photos live in the Supabase Storage bucket `bills`, not in Postgres, so
`pg_dump` does not touch them. Copy them with the S3-compatible endpoint —
see §3 step 4, which is the same operation.

---

## 3. Moving the database to Singapore

The project currently runs in **East US (North Virginia)**. Every query from
Pakistan crosses the Atlantic and back — roughly 250ms before the database has
done any work. Singapore (`ap-southeast-1`) is about a fifth of that.

Supabase cannot move a project between regions. You create a new one and migrate
into it. Budget an hour, and do it outside working hours: the app is unusable
for the middle part of it.

You have to do this yourself — it needs your Supabase and Vercel logins.

**1. Tell the team.** Nobody should log an expense during the window; anything
submitted after the dump is taken will not be in the new database.

**2. Create the new project.** Supabase → New project → Region **Southeast Asia
(Singapore)**. Save the database password it gives you.

**3. Move the data.**

```bash
# from the OLD project (direct connection, port 5432)
pg_dump "$OLD_DIRECT_URL" --format=custom --no-owner --no-privileges --file=move.dump

# into the NEW project
pg_restore --dbname "$NEW_DIRECT_URL" --no-owner --no-privileges move.dump
```

Role and extension errors are expected and harmless. Then check the numbers
match on both sides before you go any further:

```bash
for url in "$OLD_DIRECT_URL" "$NEW_DIRECT_URL"; do
  psql "$url" -Atc "select 'users', count(*) from app_user
                    union all select 'sites', count(*) from site
                    union all select 'expenses', count(*) from expense
                    union all select 'funds', count(*) from fund_txn
                    union all select 'audit', count(*) from audit_log"
done
```

**4. Move the bill photos.** These are in Storage, not Postgres. Both projects
expose an S3-compatible endpoint — Project Settings → Storage → S3 connection
gives you the endpoint and an access key pair.

Create the `bills` bucket in the new project first (private), then:

```bash
# rclone config entries "old" and "new", both type=s3, provider=Other,
# with each project's endpoint and access keys
rclone sync old:bills new:bills --progress
```

**5. Repoint Vercel.** Project → Settings → Environment Variables, replace with
the new project's values: `POSTGRES_URL` (pooler, 6543), `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Leave `JWT_SECRET` **unchanged** — changing it signs everyone out.

**6. Redeploy.** Deployments → latest → Redeploy. Environment variables are read
at build time, so an existing deployment will not pick them up on its own.

**7. Check it.** Sign in as the owner and confirm:
- the dashboard totals match what they were before,
- a bill photo opens (proves Storage came across),
- **Activity log** shows history (proves `audit_log` came across),
- logging a test expense works, then delete it.

**8. Update the backup secret.** `SUPABASE_DB_URL` in the repository secrets
still points at the old project. Change it, then run the backup workflow
manually (Actions → Database backup → Run workflow) and confirm it passes.

**9. Only then**, pause the old project. Leave it paused rather than deleted for
a couple of weeks.

---

## 4. Applying schema changes

Migrations live in `supabase/migrations/` and are written to be re-runnable
(`if not exists` / `or replace` throughout). Either paste them into the Supabase
SQL editor in order, or call the setup endpoint, which applies every migration
in sequence:

```bash
curl -X POST "https://kcems.vercel.app/api/setup?token=$SETUP_TOKEN"
```

`/api/setup` is disabled unless `SETUP_TOKEN` is set in the Vercel environment,
and it only seeds demo data when `SEED_PASSWORD` is also set and the user table
is empty. On a live database it applies the schema and stops.
