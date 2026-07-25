# MiDigitalExpansion CRM

An internal CRM for a two-person digital agency (Brian — build, Cole — sales) whose business model is a service ladder:

```
Website Build → Brand Curation → Social Media Management → Analytics
```

The website build is the foot in the door; the business is the **$500–$1,000/month retainer** that should follow it. The single biggest risk is a client getting a site delivered and then falling through the cracks. **Everything in this app exists to make ladder progression and MRR impossible to forget.**

It runs entirely on Cloudflare — one Worker, no other infrastructure.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + TanStack Query + React Router 6 |
| Charts / icons / DnD | recharts, lucide-react, @dnd-kit/core |
| Hosting | A single **Cloudflare Worker** serving both the API and the React build |
| API | Hono |
| Database | **Cloudflare D1** (SQLite) via Prisma 7 + `@prisma/adapter-d1` |
| Auth | JWT in an httpOnly cookie, signed with WebCrypto; PBKDF2-SHA256 password hashes |
| Automation | **Cloudflare Cron Triggers**, daily at 06:00 Eastern |
| File storage | **Cloudflare R2**, bound directly to the Worker (optional) |
| Email | Resend over `fetch` (optional — logs to console when unconfigured) |

Because one Worker serves the app *and* the API, the session cookie is first-party and there is no CORS in the normal path.

---

## Deploying to Cloudflare

You need a Cloudflare account on the **Workers Paid plan ($5/month)** — see [Why the Paid plan](#why-the-paid-plan) below.

> **Already done for the production account.** The D1 database
> `midigitalexpansion-crm` exists (id `c76d91ea-…`, ENAM, already committed to
> `wrangler.jsonc`), the schema is applied, and it holds the seeded users,
> six automation rules and five founding clients. Steps 1, 4 and 5 below are
> history for that account — what remains is `JWT_SECRET` (step 3) and the
> deploy. Uploads are off until R2 is enabled; see step 2.

```bash
npm run install:all
npx wrangler login
```

**1. Create the database** and paste the id it prints into `d1_databases[0].database_id` in `wrangler.jsonc`:

```bash
npx wrangler d1 create midigitalexpansion-crm
```

**2. Create the documents bucket.** R2 has to be enabled on the account first — a
one-time opt-in under **Storage & Databases → R2** that asks for a payment
method. Until it is, the API refuses with `10042` and the `r2_buckets` block in
`wrangler.jsonc` stays commented out, which leaves the Documents tab
reporting uploads disabled rather than erroring. Everything else works without it.

```bash
npx wrangler r2 bucket create midigitalexpansion-crm-documents
```

**3. Set the secrets.** Only `JWT_SECRET` is required:

```bash
npx wrangler secret put JWT_SECRET        # 16+ chars: openssl rand -hex 32
npx wrangler secret put SEED_SECRET       # lets you run the one-time seed
npx wrangler secret put AUTOMATION_SECRET # optional: fire the engine by hand
npx wrangler secret put RESEND_API_KEY    # optional: notification emails
```

**4. Create the schema, then deploy:**

```bash
npm run migrate:remote
npm run deploy
```

**5. Seed** the two users, six automation rules and the five founding clients (safe to re-run — it never duplicates):

```bash
CRM_URL=https://midigitalexpansion-crm.<your-subdomain>.workers.dev \
SEED_SECRET=<the value from step 3> \
npm run seed:remote
```

Then open the Worker's URL and log in:

| User | Email | Role |
|---|---|---|
| Brian | `brian@midigitalexpansion.com` | Technical |
| Cole | `cole@midigitalexpansion.com` | Sales |

Password: `changeme123` (override with a `SEED_PASSWORD` secret). **Change it after first login.**

The 6am automation job needs no further setup — `triggers.crons` in `wrangler.jsonc` registers it on deploy.

### Deploying from Git instead (Workers Builds)

To have Cloudflare build and deploy on every push, connect the repo under
**Workers & Pages → your Worker → Settings → Builds** and set:

| Field | Value |
|---|---|
| Root directory | `/` (leave it at the repo root) |
| Build command | `npm run cf:build` (`npm run build` also works) |
| Deploy command | `npx wrangler deploy` |

`wrangler.jsonc` lives at the **repo root**, so the plain deploy command is the
correct one — no `--config` needed. It used to live in `server/`, and that cost
two failed deploys and a blank production site: with no config at the root,
`wrangler deploy` falls back to static-site detection and ships the *source*
`client/` directory. The browser then gets an `index.html` pointing at
`/src/main.tsx` — TypeScript it cannot execute — and renders a blank page with no
API attached. One Worker spans both workspaces, so its config belongs at the root
that contains both.

Either build command works because both start with `ensure:deps`. That matters
more than it looks: the root has no dependencies of its own, so the provider's
own install step (it picks `bun install`) installs nothing and leaves `client/`
and `server/` empty — the build then dies on `tsc: not found`, which reads like a
missing devDependency rather than a missing install. `ensure:deps` installs
either workspace whose binaries are absent, so it is a no-op locally and the real
install in CI.

`cf:build` is the leaner of the two: it builds the React app and runs `prisma
generate`, and stops there. That last step is not optional — the generated client
is gitignored, so a clean clone cannot bundle the Worker without it. Plain `build`
does the same and then bundles the Worker as a dry run, which is a useful check
and a few wasted seconds in CI.

Steps 1–3 above still have to happen first, and the **`database_id` must be
committed**: builds deploy what's in Git, so the placeholder in
`wrangler.jsonc` will fail the deploy until the real id is pushed. Set
secrets on the Worker itself (**Settings → Variables and Secrets**, or
`wrangler secret put`) — they are not build-time variables, and `cf:build` never
sees them.

Migrations are deliberately *not* part of the build. Schema changes apply from a
workstation with `npm run migrate:remote`, so a deploy can never silently rewrite
the only copy of the client database.

### Optional: a custom domain

Add a route to `wrangler.jsonc` and redeploy:

```jsonc
"routes": [{ "pattern": "crm.midigitalexpansion.com", "custom_domain": true }]
```

### Optional: serve documents straight from R2

By default documents stream back through the Worker, so they stay behind the session cookie. If you'd rather serve them from the bucket directly, give it a public domain and set `R2_PUBLIC_BASE_URL` in `vars` — but note that makes every uploaded document readable by anyone with the URL.

---

## Running it locally

```bash
npm run install:all
cp .dev.vars.example .dev.vars                 # local secrets, gitignored

npm run migrate:local                          # creates the local D1 file
npm run dev:server                             # Worker on :8787
npm run seed:local                             # in another terminal
npm run dev:client                             # Vite on :5173, proxying /api
```

Use `http://localhost:5173` for hot reload while working on the frontend, or `http://localhost:8787` to exercise exactly what production serves.

Nothing touches your Cloudflare account until you deploy: `wrangler dev` runs D1 and R2 on disk under `.wrangler/` at the repo root.

---

## Project layout

```
wrangler.jsonc               bindings, cron schedule, static assets, cron
.dev.vars                    local secrets (gitignored)
server/
  prisma/schema.prisma       data model
  prisma.config.ts           CLI-only config (the Worker uses the D1 binding)
  migrations/                plain .sql, applied by wrangler
  scripts/makeMigration.ts   schema diff -> the next migration file
  scripts/seed.ts            triggers the in-Worker seed over HTTP
  scripts/lifecycleCheck.ts  end-to-end smoke test (31 assertions)
  src/index.ts               Worker entry: fetch + scheduled
  src/app.ts                 Hono app, route mounting, auth wall
  src/domain/enums.ts        the enums SQLite can't hold
  src/config/                env accessors, per-request Prisma client
  src/lib/                   password hashing, JWT, error mapping
  src/routes/                one router per resource
  src/services/              tier changes, MRR math, dashboard, email, R2
  src/jobs/automationEngine  the daily rule engine
  src/seed/seedData.ts       users, rules, the five founding clients
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
`PATCH /api/clients/:id/tier` is the only path allowed to change `currentTier`. It writes a `ServiceHistoryEntry`, backfills `websiteLaunchDate` the first time a site goes live, and cancels the open auto-tasks belonging to the tier just left. Recurring check-ins and renewal reminders deliberately survive a tier change.

### Automation engine
Runs daily on a Cron Trigger. For every active client × every active rule it works out the anchor date, and creates a task once the countdown has elapsed — unless that rule already has a live task for that client, which makes re-runs idempotent.

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

### Appearance

The UI follows macOS conventions: the system font stack (SF on Apple hardware),
a translucent vibrancy sidebar over a window background, 6px controls and 10px
grouped boxes, accent-filled sidebar selection, and recessed segmented controls.
The accent is the brand indigo, not Apple's system blue.

**Light and dark follow the OS, with no in-app toggle** — a macOS app takes the
system appearance. That is built on semantic colour tokens (`bg-content`,
`text-ink`, `border-separator`) which resolve to CSS variables redefined under
`prefers-color-scheme: dark`. The alternative, a `dark:` variant on every
coloured utility, would have doubled ~430 call sites and made every future page a
chance to forget one. Tokens hold RGB channels so `text-ink/70` still works,
because macOS builds text hierarchy by fading one ink colour.

Two things are deliberately *not* token-driven. Tier and interaction badges stay
hue-coded — the ladder is read by colour, and six shades of one accent would not
be — so each carries an explicit dark pair. And recharts takes concrete colour
strings for axes and tooltips rather than CSS variables, so `lib/chartTheme.ts`
reads the tokens and re-reads them on appearance change.

**Where this departs from Apple:** macOS uses roughly 60% and 35% ink opacity for
secondary and tertiary text, which fails WCAG AA at body sizes. Measured against
rendered backgrounds, those values produced 187 sub-AA text instances across the
two appearances. The floors are raised to 65–70%, which compresses the hierarchy
slightly and takes both appearances to **zero AA failures**. For a tool someone
reads all day, legibility beats fidelity.

### Desktop and mobile

The primary target is a laptop browser, but Cole updates records from his phone
after calls, so both are treated as real. Three rules keep them honest:

**Touch targets are 44px below `lg`, compact above it.** The pattern is
`min-h-11 lg:min-h-9`, or a 44px wrapper around a visually small control — the
task checkbox and the deal drag handle both stay their original size while their
hit area grows. `lg`, not `md`: a tablet is a touch device.

**Nothing important hides behind `:hover`.** Reveal-on-hover controls silently do
not exist on touch. The snooze button was `opacity-0 group-hover:opacity-100`,
which made snoozing desktop-only; it is now visible by default and only hides
behind hover inside `@media (any-hover: hover)`.

**Wide tables become lists, not sideways scroll.** The automation rules table has
a ~890px min-content width, and no `overflow-x` wrapper makes that usable at
390px — it just produces a page that scrolls sideways. Below `lg` the same fields
render as a stacked list; the table returns when it fits. Both presentations
share the cell components so they cannot disagree.

Verified by an instrumented pass over every route at 390/768/1440: no horizontal
document overflow, no element escaping the viewport, no unlabelled inputs.

### Bundle size

Pages load on demand. Importing all eight eagerly put recharts and @dnd-kit —
used by two pages — into a single ~740 KB bundle that every visitor downloaded
before seeing the login form. Route-level `lazy` plus deferring the dashboard
chart brings first load to ~220 KB (70 KB gzipped), with recharts' ~105 KB
arriving only when a chart actually renders.

---

## What the Cloudflare platform decides for you

These are the places where running on Workers/D1 changed a design decision, not just the deployment target.

**D1 has no transactions.** This is the significant one. D1 doesn't support them, and Prisma's D1 adapter quietly downgrades `$transaction` to a sequence of individual queries ([details](https://pris.ly/d/d1-transactions)). The Postgres build wrapped tier changes, contact-primary swaps and deal conversion in real transactions; those are now *ordered by failure consequence* instead, so every partial outcome is visible in the UI and self-corrects rather than rotting silently. A tier change can never end up with a changed `currentTier` and no audit row — the one combination that would break the automation engine's anchors. Each affected write path carries a comment explaining its ordering.

**No enums, no `Decimal`.** SQLite has neither. Enum columns are `String`, with the allowed values in `src/domain/enums.ts` and enforced by Zod on every write; money is `Float`, which is exact for the whole-dollar monthly amounts this app deals in.

**No presigned upload URLs.** A bound R2 bucket is reached by capability, not by S3 credentials, so there is nothing to sign with. Uploads are one multipart request through the Worker — which also removed both AWS SDK packages and made a half-finished upload impossible, since the object and the row now land together.

**bcrypt is gone.** It can't run in a Worker's CPU budget. Passwords use PBKDF2-SHA256 via WebCrypto, with the iteration count stored inside each hash so it can be raised later without invalidating existing ones.

**The cron lives outside the process.** There's no long-running process for `node-cron` to keep a timer in, so the schedule is `triggers.crons` in `wrangler.jsonc` and arrives as a `scheduled` event. Cron Triggers fire in **UTC**: `0 10 * * *` is 6am Eastern during EDT and drifts to 5am when Michigan returns to EST. Adjust it if that matters.

### Why the Paid plan

The Free plan caps CPU at 10 ms per invocation. Password hashing deliberately costs ~25–30 ms, so **logins fail on the Free plan**. Every other request in the app is far below the limit; this is the only reason the $5/month plan is needed. To stay on Free instead, lower `ITERATIONS` in `src/lib/password.ts` — the trade-off is spelled out there.

Nothing else costs anything at this scale: D1's free allowance (5 GB, 5M row reads/day) and R2's (10 GB) are far beyond a two-person agency's needs.

---

## Verification

```bash
npm run typecheck        # server + client
npm run build            # client bundle + Worker bundle
npm run qa:lifecycle     # end-to-end, needs `npm run dev:server` running
```

`qa:lifecycle` drives a throwaway client through the entire ladder — deal → convert → Website Build → Live → Brand → Social → Analytics → churn — backdating anchors so every automation rule fires, asserting MRR moves exactly when retainer status says it should, and round-tripping a document through R2. It cleans up after itself.

Two of the 31 assertions are the R2 document round-trip and are skipped when no bucket is bound, so the expected result is **29 passed** until R2 is enabled.

It runs entirely over HTTP against the real API. The two operations the public API genuinely cannot express (backdating a tier-history row, hard-deleting a client) go through QA-only hooks at `/api/qa`, which mount **only** when `QA_HOOKS_ENABLED=true` — set in `.dev.vars`, never in production.

---

## Changing the schema

```bash
npm run migrate:new -- add_client_tags   # writes migrations/000N_add_client_tags.sql
npm run migrate:local                    # try it locally
npm run migrate:remote                   # then apply it for real
```

`prisma migrate dev` can't be used — it wants to connect to the database, and D1 only accepts connections from a Worker. `migrate:new` replays the existing migrations into a scratch SQLite file, diffs your schema against it, and writes the difference out as the next numbered `.sql` for wrangler to apply. Review the SQL before applying it.

---

## Configuration

Everything except `JWT_SECRET` is optional and degrades gracefully: with no `RESEND_API_KEY` notification emails log to the console, and with no R2 bucket bound the Documents tab explains that uploads are disabled rather than erroring.

Plaintext settings live in `vars` in `wrangler.jsonc`; secrets are set with `npx wrangler secret put NAME`, and for local development in `.dev.vars` at the repo root.

| Name | Kind | Purpose |
|---|---|---|
| `JWT_SECRET` | secret | Session signing key, 16+ chars (**required**) |
| `SEED_SECRET` | secret | Guards `POST /api/internal/seed` |
| `SEED_PASSWORD` | secret | Password for the seeded users (default `changeme123`) |
| `AUTOMATION_SECRET` | secret | Guards `POST /api/internal/run-automation` |
| `RESEND_API_KEY` | secret | Task notification emails |
| `QA_HOOKS_ENABLED` | secret | Mounts the QA hooks. **Development only** |
| `APP_ENV` | var | `production` marks the session cookie `Secure` |
| `MAIL_FROM` | var | From address on notification emails |
| `R2_PUBLIC_BASE_URL` | var | Public bucket domain; blank streams via the Worker |
| `CORS_ORIGIN` | var | Only needed if the frontend is hosted off-Worker |
| `DB` | binding | D1 database |
| `DOCUMENTS` | binding | R2 bucket |
| `ASSETS` | binding | The built React app |

### Backups

D1 keeps point-in-time recovery for the last 30 days, but keep an export off-platform too:

```bash
npx wrangler d1 time-travel restore midigitalexpansion-crm --timestamp=<unix-seconds>
npx wrangler d1 export midigitalexpansion-crm --remote --output=backup.sql
```

This database is the only record of every client relationship the business has. Take the export on a schedule.
