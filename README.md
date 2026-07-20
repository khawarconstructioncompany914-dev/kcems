# KCEMS — Khawar Construction Site Expense Management System

A working front-end implementation of **`KCEMS Screens.dc.html`**, skinned with the
`KCEMS Build Spec` design tokens (§5) and wired to the Build-Spec approval state
machine (§3). It runs entirely client-side: an in-memory store (persisted to
`localStorage`) is seeded to match the numbers in the design gallery, so the
approval flow, cash math and role-based routing genuinely work — no backend needed.

## Run

```bash
npm install
npm run dev        # → http://localhost:5183
```

Sign in with **username + password**. In dev, the seeded accounts all use password
`kcems` and a quick-login row is shown (owner `messam`, admin `junaid`, finance
`tariq`, engineer `ali`, supervisor `faraz`). Accounts created in-app get a temp
password and are forced to set their own on first login.

To deploy for real (GitHub + Vercel + Supabase, all free) see **[DEPLOY.md](DEPLOY.md)**.

## What's implemented

| Build-Spec screen group | Surface(s) in this app |
|---|---|
| **1 · Auth & onboarding** | `Login` + interactive role router · owner `Invite member` modal |
| **2 · Supervisor field app** | `/m` phone-framed app: cash-in-hand home, log expense, history, funds, me |
| **3 · Admin access control** | `/admin`: reporting-tree wiring (re-assign supervisors) + permission matrix |
| **4 · Site detail + reports** | `/sites/:id` detail with category bars · `/reports` builder with real CSV export |
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
  data/model.js     tokens, enums, formatters (Rs grouping, compact)
  data/seed.js       demo dataset (matches the gallery numbers)
  store.jsx          reducer, state-machine actions, selectors, persistence
  components/         Logo, bits (pills/modal/toasts), page atoms, expense card, funds modal
  screens/
    Login.jsx
    office/          DesktopShell + Dashboard, ReviewQueue, Approvals, People,
                     PersonLedger, Sites, SiteDetail, Reports, AdminAccess
    mobile/          MobileShell + Home, AddExpense, History, Funds, Me
```

## Design tokens (§5)

Dark bento UI. **Acid green `#5CE62E` is reserved** for money-positive states and
primary actions only. Fonts: Space Grotesk (numbers/headings), Plus Jakarta Sans
(body), IBM Plex Mono (eyebrows/meta). All amounts in PKR (integer, `Rs 42,500`).

## Backend (not built — documented in the spec)

The `KCEMS Build Spec` §4 defines the REST contract (`/auth`, `/expenses`,
`/expenses/:id/{pass-up,approve,reject,settle}`, `/supervisors/:id/{ledger,funds}`,
`/users/invite`, `/reports`). Money endpoints run in a DB transaction; every write
is authorized against §2 and logged. This prototype models the same transitions in
the client store so the UI is fully exercisable ahead of the server.
