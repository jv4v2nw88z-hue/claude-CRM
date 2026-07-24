# MiDigitalExpansion CRM

An internal CRM for a two-person digital agency (Brian — build, Cole — sales) whose business model is a service ladder:

```
Website Build → Brand Curation → Social Media Management → Analytics
```

The website build is the foot in the door; the business is the **$500–$1,000/month retainer** that should follow it. The single biggest risk is a client getting a site delivered and then falling through the cracks. **Everything in this app exists to make ladder progression and MRR impossible to forget.**

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + TanStack Query + React Router 6 |
| Charts / icons / DnD | recharts, lucide-react, @dnd-kit/core |
| Backend | Node + Express + TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Auth | JWT in an httpOnly cookie (bcrypt password hashes) |
| Automation | node-cron, daily at 6am |
| Email | Resend (optional — logs to console when unconfigured) |
| File storage | S3-compatible / Cloudflare R2 via presigned URLs (optional) |

---

## Getting started

Requires Node 20+ and a PostgreSQL 14+ instance.

```bash
# 1. Install
npm run install:all

# 2. Configure the backend
cp server/.env.example server/.env
#    Set DATABASE_URL and a long random JWT_SECRET.

# 3. Create the schema and seed it
npm run migrate
npm run seed

# 4. Run both processes (two terminals)
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173
```

Seeded logins (**change the password after first login**):

| User | Email | Role |
|---|---|---|
| Brian | `brian@midigitalexpansion.com` | Technical |
| Cole | `cole@midigitalexpansion.com` | Sales |

Password: `changeme123` (override with `SEED_PASSWORD`).

The seed also loads the five current clients — Sunrise Cafe, Hamilton Landscape Supply, Royal Kicks, Pennfield Pizza, Glass Family Dental — with the history that makes the dashboard truthful on day one, including Sunrise Cafe sitting at Website Live with no retainer.

---

## Project layout

```
server/
  prisma/schema.prisma       data model + migrations
  prisma/seed.ts             users, clients, automation rules
  scripts/lifecycleCheck.ts  end-to-end smoke test (29 assertions)
  src/config/                env validation, Prisma client
  src/middleware/            requireAuth, error handling
  src/routes/                one router per resource
  src/services/              tier changes, MRR math, dashboard, email, storage
  src/jobs/automationEngine  the daily rule engine
client/
  src/pages/                 Dashboard, Clients, ClientDetail, Deals, Tasks, Revenue, Automations, Login
  src/components/            StatCard, TierBadge, AtRiskPanel, TaskChecklist, kanban, slide-overs…
  src/hooks/queries.ts       every TanStack Query hook
  src/api/                   fetch wrapper + one module per resource
```

---

## The parts that matter

### At-risk detection
A client at `WEBSITE_LIVE` for **45+ days with no ACTIVE retainer** is at risk. This drives the loudest widget on the dashboard, a filter on the client list, and a badge on every row. The "Pitch Now" button logs the interaction and closes the open upsell task in a single step, so recording a pitch takes seconds and therefore actually happens.

### MRR
MRR is the sum of **ACTIVE** retainers only. `PENDING_FIRST_PAYMENT` is reported separately as pending, and paused or cancelled retainers drop out immediately — a lapsed retainer can never silently inflate the headline number. The 6-month trend reconstructs each month from retainer start/end dates rather than snapshotting, so history stays correct when a record is edited after the fact.

### Tier changes
`PATCH /api/clients/:id/tier` is the only path allowed to change `currentTier`. In one transaction it writes a `ServiceHistoryEntry`, backfills `websiteLaunchDate` the first time a site goes live, and cancels the open auto-tasks belonging to the tier just left. Recurring check-ins and renewal reminders deliberately survive a tier change.

### Automation engine
Runs daily at 6am (`AUTOMATION_CRON`). For every active client × every active rule it works out the anchor date, and creates a task once the countdown has elapsed — unless that rule already has a live task for that client, which makes re-runs idempotent.

Seeded rules:

| Rule | Trigger | Timing |
|---|---|---|
| Pitch Brand Curation | Website Live | 30 days after launch |
| Escalate Unpitched Website Client | Website Live | 60 days after launch |
| Pitch Social Media Management | Brand Curation | 45 days after tier change |
| Pitch Analytics Package | Social Media | 60 days after tier change |
| Quarterly Check-in | any tier, active retainer | every 90 days |
| Contract Renewal Reminder | any tier, retainer with an end date | 14 days before expiry |

All six are editable at **Settings → Automations** without a deploy, and the page has a **Run now** button for testing.

#### Schema note
The spec's `AutomationRule` model covers the four tier-based rules but can't express the last two, so three fields were added: `anchor` (`TIER_CHANGE` / `RETAINER_START` / `RETAINER_END`), `repeatEveryDays` for recurring rules, and `requiresActiveRetainer`. `triggerTier` is nullable (null = any tier) and `daysAfterTrigger` accepts negatives so a rule can fire *before* a `RETAINER_END` anchor. The four original rules behave exactly as specified.

---

## Verification

```bash
npm run typecheck        # server + client
npm run build            # compiles both
npm run qa:lifecycle     # end-to-end, needs the server running
```

`qa:lifecycle` drives a throwaway client through the entire ladder — deal → convert → Website Build → Live → Brand → Social → Analytics → churn — backdating anchors so every automation rule fires, and asserting MRR moves exactly when retainer status says it should. It cleans up after itself.

---

## Configuration

Everything beyond `DATABASE_URL` and `JWT_SECRET` is optional and degrades gracefully: with no `RESEND_API_KEY` notification emails log to the console, and with no S3 credentials the Documents tab explains that uploads are disabled rather than erroring.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `JWT_SECRET` | Session signing key, 16+ chars (**required**) |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins |
| `AUTOMATION_CRON` | Cron expression for the engine (default `0 6 * * *`) |
| `DISABLE_CRON` | Set `true` to turn the in-process job off |
| `AUTOMATION_SECRET` | Shared secret for `POST /api/internal/run-automation` |
| `RESEND_API_KEY` / `MAIL_FROM` | Task notification emails |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_PUBLIC_BASE_URL` | Document storage (set `S3_ENDPOINT` for Cloudflare R2) |

---

## Deploying

1. **Database** — provision Postgres, then `npm run prisma:deploy --prefix server` and `npm run seed --prefix server` once.
2. **Backend** — deploy `server/` as a Node service. The cron job runs in-process; if the host sleeps the service, leave `DISABLE_CRON=true`, set `AUTOMATION_SECRET`, and point an external cron at `POST /api/internal/run-automation` with an `x-automation-secret` header.
3. **Frontend** — deploy `client/` as a static build with `VITE_API_BASE_URL` set to the API origin, and add that origin to the backend's `CORS_ORIGIN`. Cookies are `SameSite=None; Secure` in production, so both sides must be HTTPS.
4. **Backups** — enable automatic daily Postgres backups. This database is the only record of every client relationship the business has.
