# KCEMS — Khawar Construction Site Expense Management System

Site expense management for Khawar Construction: supervisors log expenses from
their phone, head engineers review, finance approves, and every rupee of cash in
a supervisor's hand is derived rather than stored.

Runs in one of two modes, set by `VITE_DATA_SOURCE`:

- **`local`** (default) — an in-browser store seeded to match the design gallery.
  No backend needed; the approval flow, cash maths and role routing all work.
- **`supabase`** — the live deployment: the same UI against the `/api`
  serverless layer and Supabase Postgres. This is what runs in production.

Skinned with the `KCEMS Build Spec` design tokens (§5) and wired to the
Build-Spec approval state machine (§3).

## Run

```bash
npm install
npm run dev        # → http://localhost:5183
```

Sign in with **username + password**. In dev, the seeded accounts all use password
`kcems` and a quick-login row is shown (owner `meesamali`, admin `muzamilalisher`, finance
`tariqismail`, engineer `alikhawaja`, supervisor `faraz`). Accounts created in-app get a temp
password and are forced to set their own on first login.

To deploy for real (GitHub + Vercel + Supabase, all free) see **[DEPLOY.md](DEPLOY.md)**.

## What's implemented

| Build-Spec screen group | Surface(s) in this app |
|---|---|
| **1 · Auth & onboarding** | `Login` + interactive role router · owner `Invite member` modal |
| **2 · Supervisor field app** | `/m` phone-framed app: cash-in-hand home, log expense, history, funds, me |
| **3 · Admin access control** | `/admin`: reporting-tree wiring (re-assign supervisors), logins, password resets |
| **4 · Site detail + reports** | `/sites/:id` detail with category bars · `/reports` builder exporting CSV, Excel (.xlsx) and PDF |
| _audit_ | `/activity`: the append-only `audit_log`, owner/admin only |
| _router targets_ | owner `Dashboard`, engineer `Review queue`, finance `Approvals`, `People` + ledgers |

## The approval state machine (§3)

`engineer_review → finance_review → approved` (deducts supervisor cash, atomically).
Any review stage → `rejected` (reason required → becomes owed-back). Engineer can
`return` an item (note back to the supervisor's phone). `rejected → settled` records
a settlement fund txn and clears the owed balance. Every transition writes an
append-only `AuditLog` row.

Derived, never stored (§1):
- `cashInHand` = Σ funds_in − Σ approved expenses
- `owedBack`   = Σ rejected expenses where `settledAt` is null

## Roles & scoping (§2)

5 roles: `owner` sees & does everything · `admin` views all + creates/edits users
and wires supervisors to engineers & sites · `finance` (Tariq) approves/funds/exports
(all sites) · `engineer` reviews & sees only supervisors wired under them ·
`supervisor` logs expenses on the field app and sees only their own cash.
Enforced here in `scopedExpenses` / `scopedSites` + per-route `RoleGate`s
(in the live build this is enforced server-side in `/api` — the UI only hides controls).

## Installable PWA

`vite-plugin-pwa` ships a manifest + service worker, so `npm run build` produces an
installable app. Supervisors just open the address on their phone and can
"Add to Home Screen" — no app store.

## Structure

```
src/
  data/model.js      tokens, enums, formatters (Rs grouping, compact)
  data/match.js      forgiving login matching — shared with api/login.js
  data/seed.js       demo dataset (matches the gallery numbers)
  store.jsx          reducer, state-machine actions, selectors; local + live providers
  offline.js         IndexedDB snapshot + write queue for the field app
  components/        Logo, bits (pills/modal/toasts), page atoms, expense card,
                     funds modal, sync/connection banner
  screens/
    Login.jsx
    office/          Dashboard, ReviewQueue, Approvals, People, PersonLedger,
                     Sites, SiteDetail, Reports, Activity, AdminAccess, Bills
    mobile/          Home, AddExpense, History, Funds, Attendance, Me
api/                 Vercel serverless: login, logout, me, data, action,
                     bill/bills-signed, health, setup
supabase/migrations/ 0001 schema+views · 0002 state machine · 0003 photos+claims
                     0004 progress+attendance · 0005 rate limit+replay guard
scripts/             roster-sync.js, rotate-passwords.js
```

## Design tokens (§5)

Dark bento UI. **Acid green `#5CE62E` is reserved** for money-positive states and
primary actions only. Fonts: Space Grotesk (numbers/headings), Plus Jakarta Sans
(body), IBM Plex Mono (eyebrows/meta). All amounts in PKR (integer, `Rs 42,500`).

## Backend

Built and live. `VITE_DATA_SOURCE=supabase` swaps the in-browser store for the
`/api` serverless layer on Vercel, talking to Supabase Postgres:

- **`/api/login`** — fuzzy name matching (`src/data/match.js`, shared with the
  demo store so both behave identically), bcrypt, a signed HttpOnly session
  cookie, and DB-backed rate limiting keyed on what was *typed* rather than on
  whoever matched.
- **`/api/data`** — one scoped snapshot per role (Build Spec §2). Historical rows
  are windowed to keep the payload bounded, but **money totals come from the
  `v_supervisor_balance` / `v_site_spend` views**, computed over the whole
  ledger — a balance summed from a truncated history would be wrong.
- **`/api/action`** — every write, authorized server-side and running the atomic
  state-machine functions from `supabase/migrations/0002_functions.sql`. Each
  one writes an `audit_log` row in the same transaction as the change.
- **`/api/setup`** — applies the migrations. Disabled unless `SETUP_TOKEN` is set.

The UI only hides controls; permission is decided in `/api`.

## Works without signal

Sites lose connection, and a supervisor holding a paper bill cannot wait for it.

- The last `/api/data` response is cached in IndexedDB, so the app opens with
  real numbers instead of a spinner — and says on screen that what you are
  looking at is saved rather than live.
- Expenses, attendance and progress logged with no signal are queued locally,
  shown immediately in the UI as pending, and sent in order when the connection
  returns. Approvals and funds are deliberately **not** queued: deciding on a
  stale snapshot is worse than being told to wait.
- Every queued write carries a `clientRef` the server claims before doing the
  work, so a reply lost on the way back cannot become a second expense for the
  same bill.

## Operations

Rotating passwords, restoring a backup and moving the database region are in
**[docs/OPERATIONS.md](docs/OPERATIONS.md)**. Nightly encrypted, restore-verified
backups run from `.github/workflows/backup.yml`.
