# Datastraw Smart Roster

Monthly roster planning for multi-brand CX operations: generates rosters, validates coverage, flags conflicts, and revalidates after changes.

**Live app:** <URL> · **Demo video:** <URL> · **Demo login:** `manager@demo.com` / `<demo-password>` (demo data only)

## Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + TanStack Query | Typed UI, server-state caching |
| Backend | Node.js + Express + TypeScript | Stateless REST API |
| DB | PostgreSQL + Prisma | Relational constraints, many-to-many, transactions |
| Auth | JWT (HttpOnly cookie) + bcrypt + RBAC | Internal tool, no public signup |
| Validation | Zod | Same schemas validate every request |
| Security | helmet, express-rate-limit, CORS allow-list | See Security section |
| Tests | Vitest | Engine is pure functions -> easy to test |
| Deploy | Vercel (web), Render (api), Neon (db) | Free tiers |

## Architecture
```
React UI -> Express routes -> controllers -> services -> repositories (Prisma) -> PostgreSQL
                                   |
                                   v
                          engine/ (PURE TS, no DB, no HTTP)
                  availability -> generate -> coverage -> validate -> suggest
```
- `engine/` receives plain data and returns a roster + issues. It never touches the DB, so it is unit-testable.
- `services/` load data, call the engine, and persist results inside a transaction.

## Data model (summary)
`pods` · `employees` · `brands` · `processes` · `brand_processes` (brand x process with operating rule + min coverage) · `assignments` (employee <-> brand_process, many-to-many) · `holidays` · `leaves` (LEAVE / COMP_OFF) · `weekly_off_preferences` · `rosters` (month, status, version) · `roster_entries` (employee, date, status, source AUTO/MANUAL) · `roster_issues` · `users` · `audit_log`

Key point: **brand operating calendar** (`brand_processes.operating_rule`) is separate from **employee day status** (`roster_entries.status`).

## How the engine works
1. Load active employees, assignments, rules, holidays, leaves for the month.
2. Mark hard-unavailable days (leave, comp-off, holiday where employee's processes are closed).
3. Place weekly offs: most-constrained employees first; each off-day chosen where coverage slack is highest; preference honoured only if it does not break coverage.
4. Compute coverage per (brand_process, date) = number of WORKING assigned employees.
5. Validate -> issues: `COVERAGE_GAP` (mandatory), `SINGLE_POINT_OF_FAILURE`, `PREFERENCE_VIOLATED` (soft), `OVERLOADED_EMPLOYEE`.
6. Suggest backups for each gap (same pod first, then others who are off/free and skill-matched).
7. Manual edit -> revalidate only affected dates and processes.

Heuristic, not an optimal solver. Mandatory constraints always win over preferences.

## Assumptions
- A working employee covers **all** processes assigned to them that day (this is how single-resource brands work).
- One weekly off per employee per calendar week unless configured otherwise.
- Public holiday: employee is off only if all their processes are closed that day; otherwise they work and earn a comp-off.
- Leave and comp-off are approved on entry (no approval workflow in MVP).
- Shifts are not modelled; one status per employee per day.

## Local setup
```bash
git clone <repo> && cd datastraw-smart-roster
cp apps/api/.env.example apps/api/.env      # fill DATABASE_URL, JWT_SECRET
cp apps/web/.env.example apps/web/.env      # VITE_API_URL
npm install
npm run db:migrate && npm run db:seed       # 32 employees, 10 brands, 4 pods
npm run dev                                 # web :5173, api :4000
npm test
```

`.env.example`
```
# api
DATABASE_URL=postgresql://user:pass@host/db
JWT_SECRET=change-me
CLIENT_ORIGIN=http://localhost:5173
# web
VITE_API_URL=http://localhost:4000
```

## Security
Parameterised queries (Prisma) · Zod validation + field whitelists · bcrypt · HttpOnly + SameSite cookies · helmet · CORS allow-list · rate limit (global + strict on `/auth/login`) · RBAC middleware on every route · optimistic locking (`version`) on rosters.

## Tell us how you think
> Write these in your own words before submitting. Hints in brackets.

1. **Modelling:** [many-to-many via assignments; brand_process as the unit of coverage; pods and leads]
2. **Generation and validation:** [phases above; coverage computed from entries, never trusted from generator]
3. **Single vs multi-resource brands:** [single = automatic single point of failure; multi = slack computed]
4. **Sole employee unavailable:** [CRITICAL gap, explanation, ranked backup suggestions, manager decides]
5. **Conflicts / insufficient staffing:** [mandatory vs soft; nothing silently dropped]
6. **Automated vs human:** [auto: generation, detection, suggestions; human: publish, approving gap resolutions]
7. **2x scale:** [background job queue, indexes, partition by month, incremental revalidation, maybe CP-SAT solver]
8. **One more week:** [fair weekly-off distribution, approval workflow, CSV export, AI conflict explanations]

## Branching
`main` (deployable) <- `develop` <- `feat/*`. Conventional commits.