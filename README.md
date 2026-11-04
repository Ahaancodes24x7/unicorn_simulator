# Silicon Valley: Unicorn Simulator

A competitive, turn-based startup strategy game for events and classrooms. Teams start with **$1,000**, get one of four problem tracks, hire a team, pick task cards, raise venture rounds, and race up a live leaderboard. Organizers run everything from a restricted admin console.

## Quick start

Requires Node.js 20+.

```bash
npm install
cp .env.example .env          # then set ADMIN_EMAILS, ADMIN_INITIAL_PASSWORD (12+ chars) and SMTP_*
npm run setup                 # creates the database and the admin account(s)
npm run dev                   # http://localhost:3000
```

After seeding, remove `ADMIN_INITIAL_PASSWORD` from `.env`; only the bcrypt hash is stored.

**Email is required for team registration.** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` (for Gmail: `smtp.gmail.com`, port `465`, and an App Password). In development, if `SMTP_HOST` is empty, emails are printed to the server console instead; in production the server refuses to sign students in until SMTP is configured.

| URL | Who | What |
|---|---|---|
| `/` | everyone | Animated landing page (hero only) |
| `/join` | teams | Enter with team name + access code; team leads register a team with their Gmail and get the code by email |
| `/play` | teams | Boot sequence (once per browser tab), then the participant dashboard |
| `/leaderboard` | everyone | Live leaderboard (server-sent events), suitable for a projector |
| `/admin` | organizers | Live overview, game controls, CSV export, reset. Not linked from the site; sign in at `/admin/login` |
| `/admin/teams/:id` | organizers | Timeline with roll calculations, transactions, metrics history, manual adjustments |
| `/admin/config` | organizers | Turns, budget, assignment, randomness, score weights, tracks, hiring catalog, full JSON editor |
| `/admin/audit` | organizers | Audit log of every admin action and failed login |
| `/admin/report` | organizers | Print-ready final report (Save as PDF) |

### Running an event

1. Team leads register from `/join` while the game is in **lobby**, using a Gmail address (`LEAD_EMAIL_DOMAINS`). The access code is emailed to the lead, who shares it; everyone on the team enters with the team name and code. A lead who loses the code can have a new one emailed. Organizers can create a team by hand (**+ Add team manually** on `/admin`) or issue a new code from a team's page, and see the code on screen.
2. On `/admin`, press **Start**. Teams act simultaneously, at their own pace, until they use all their turns.
3. **Pause** or **Resume** at any time; state is preserved. **End** locks the results.
4. Export from `/admin` (CSV) or `/admin/report` (PDF).

## Game design

- **Turns:** 30 by default. A task or an investor pitch uses one turn; hiring, firing and accepting an offer do not.
- **Tracks:** ClimateTech, HealthTech, FinTech and EdTech/AI. Each has its own company, market economics, task wording and critical events, all on the same balanced task graph: research → MVP → *choose* lean or premium pilot → compliance → v2 → pricing → partnership → scale → platform v3 → expansion (needs Series A) → global (needs Series B). The consulting sprint is always available as a recovery action.
- **Choose your path:** most stages offer 2–3 alternatives (validate with interviews *or* a landing page; build a proper MVP *or* a no-code prototype; run a lean, enterprise *or* community pilot; then pick one moat: AI feature, brand campaign or operational excellence). Each pilot path opens its own follow-up mission (self-serve onboarding, an anchor enterprise contract, or a referral programme). `npm run sim` plays every path; they score within about a point of each other.
- **Selling equity:** on the Funding tab, teams can sell up to 10% of the company per month to angel investors at a 30% discount to the current valuation. It doesn't use a turn, founders must keep at least 25%, and lower ownership reduces the fundraising score. All three numbers are in the settings (`equitySale`).
- **Staffing:** every task needs specific roles (for example MVP needs an Engineer, a partnership needs a CEO and Sales). Teams hire those roles, then pick which employees work on each task, up to a crew limit. Only the assigned crew's skills count.
- **Outcomes:** profitable success, strategic success, partial, failure, plus random critical events. Rolls combine team fit, difficulty, runway, reputation, risk and a seeded random modifier. The full breakdown is shown to the team and logged.
- **Funding:** Pre-seed → Seed → Series A → B → C+, each with unlock criteria. Offers show amount, pre- and post-money, ownership sold, terms and the next milestone. Some carry growth mandates that cost reputation if missed.
- **Score:** a weighted composite of valuation, unit economics, traction, execution, capital efficiency, fundraising quality and resilience. Admins can change the weights.

All formulas are in [docs/FORMULAS.md](docs/FORMULAS.md). Run `npm run sim` to play bot strategies on every track and check balance after you change content.

## Architecture

| Layer | Implementation |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, dependency-free SVG charts |
| Game engine | `src/game/`: pure, deterministic and unit-tested; no I/O |
| Backend | Next.js route handlers (`src/app/api`), persistence and orchestration in `src/lib/game.ts` |
| Database | Prisma. SQLite locally; PostgreSQL in production (picked automatically from `DATABASE_URL` by `scripts/prepare-db.mjs`) |
| Realtime | Server-sent events (`/api/stream`) with polling fallback |
| Auth | Teams: team name + access code (stored as a hash, emailed to the team lead's Gmail). Admins: allowlisted email + bcrypt password |

Data model: `GameConfig` (status + all configurable content), `Team` (state JSON + indexed metrics + optimistic `version`), `TeamSession`, `AdminUser`, `AdminSession`, `Event` (timeline, including roll calculations and score changes), `Transaction`, `MetricsSnapshot`, `AuditLog`.

## Security

- **Admin allowlist** comes only from the `ADMIN_EMAILS` environment variable (max 2) and is re-checked on every request. Credentials are never stored in code.
- **Teams** enter with team name + an 8-character access code (stored only as a hash, rate-limited per team). Per-IP limits are generous because a campus may share one public IP. `npm run mail:test -- you@gmail.com` checks the SMTP settings.
- Passwords are hashed with **bcrypt** (cost 12). Login is rate-limited per IP and per email, compared in constant time against a dummy hash for unknown emails, and every failure is audited.
- Session cookies are random 256-bit tokens, stored server-side as SHA-256 hashes, and set `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Server-side authorization** on every admin API and page. Participant APIs only ever read the caller's own team.
- Writes must be same-origin JSON (CSRF defence), and all inputs are validated with zod, including admin config edits.
- **Integrity:** all money moves happen server-side inside a DB transaction with an optimistic version check, so two teammates clicking at once can't double-resolve a turn.
- CSV exports guard against spreadsheet formula injection. Security headers are set in `next.config.ts`.
- The rate limiter is in-memory. If you run more than one instance, back it with a shared store.

## Problem sets

The four problem sets (ClimateTech, HealthTech, FinTech, EdTech/AI) are data in the game settings, not code: name, company, market economics, missions, events and wording. Edit or replace them on `/admin/config` (JSON editor). Roles (including their icon and whether they count toward CAC), funding rounds, score weights, turns and the equity-sale rules are settings too.

To assign sets yourself, set **Problem-set assignment** to **Organizers assign each team** on `/admin/config`. New teams then wait (they can't play) until you assign them. On `/admin`, the **Problem sets** panel shows how many teams have each set, a dropdown on every team row, and **Auto-assign waiting teams (balanced)**. A set can be changed until the team plays its first month.

## Hosting for 100+ teams

Load-tested locally with `npm run loadtest -- http://localhost:3000 100 60`: 100 teams × 4 devices polling every 6 s, every team playing a turn every ~10 s, plus 20 leaderboard screens, on one laptop with SQLite. Result: 0 errors; dashboard p95 281 ms, actions p95 226 ms. At 200 teams: still 0 errors, dashboard p95 2.4 s.

**Option A: Vercel + Neon Postgres (recommended if you want Vercel).** SQLite does not work on Vercel (no persistent disk), so use Postgres.
1. Create a Neon (or Supabase / Vercel Postgres) database. Copy the **pooled** connection string and the **direct** one.
2. Push this folder to a GitHub repo and import it in Vercel. Vercel runs `npm run vercel-build`, which switches Prisma to PostgreSQL, creates the tables, seeds the admin accounts and builds.
3. In Vercel → Settings → Environment Variables add: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `ADMIN_EMAILS`, `ADMIN_INITIAL_PASSWORD`, `LEAD_EMAIL_DOMAINS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `APP_URL` (your `https://…vercel.app` address).
4. Deploy, sign in at `/admin/login`, then remove `ADMIN_INITIAL_PASSWORD` and redeploy.

Notes for Vercel: rate limits are kept per server instance, so they are looser there; the live leaderboard stream reconnects every ~50 s by design; check your plan's usage limits before the event.

**Option B: one always-on server (simplest to reason about).** Railway, Render, Fly.io or any VM: `npm ci && npm run build && npm start` with the same environment variables. SQLite on a persistent disk works for one event; Postgres is safer.

Either way: rehearse with `npm run loadtest` against the deployed URL beforehand (it creates and deletes `LT-…` teams in that database, and needs `DATABASE_URL` pointing at it).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm test` | Engine unit tests (vitest) |
| `npm run lint` | Type-check |
| `npm run setup` | `prisma db push` + seed |
| `npm run sim -- 50` | Balance simulation |
| `npm run admin:hash -- "passphrase"` | Print a bcrypt hash |
| `npm run mail:test -- you@gmail.com` | Send a test email with the SMTP settings |
| `npm run loadtest -- <url> <teams> <seconds>` | Load test (creates and removes `LT-…` teams) |
| `npm run vercel-build` | Production build used by Vercel (Postgres) |

*All economic values are configurable simulation parameters, not investment advice or real-world forecasts.*
