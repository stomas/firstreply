# FirstReply

Lithuanian micro-SaaS for **FirstReply**
([firstreply.lt](https://firstreply.lt)), a micro-SaaS that helps small
Lithuanian service and installation businesses respond to written inquiries
faster (terrace builders, fence installers, carport/canopy builders, gate
installers, and standard installation providers).

The system helps them reply faster to **website form** and **Paslaugos.lt**
inquiries with an indicative price, the missing information needed for an
accurate quote, a preliminary work-start window, and one follow-up — while
keeping final quotes and dates under the owner's control.

This repository contains the public landing page, authenticated DB-backed
dashboard, response pipeline, and source-specific inbound/outbound integrations.
V1 accepts signed web-form events and Paslaugos.lt notifications routed through
dedicated Resend addresses. It intentionally does not include payments, CRM,
Gmail mailbox sync, reply sync, or automatic sending. Human-approved outbound
sending for Web form conversations is available behind a kill switch. Signed
Resend delivery webhooks continue to reconcile already accepted messages even
while new sending is disabled.

## Documentation

| Document                                                                 | Audience                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [docs/ARCHITEKTURA.md](./docs/ARCHITEKTURA.md)                           | Developers — pipeline, decision engine, AI integration, DB models, known limitations (LT)            |
| [docs/INBOUND-INTEGRATION.md](./docs/INBOUND-INTEGRATION.md)             | Developers/operators — web-form signing, Resend routing, retry and smoke tests (LT)                  |
| [docs/OUTBOUND-EMAIL-ROADMAP.md](./docs/OUTBOUND-EMAIL-ROADMAP.md)       | Product/developers — implemented outbound sending/delivery and remaining customer-reply roadmap (LT) |
| [docs/RESEND-ROLLOUT-CHECKLIST.md](./docs/RESEND-ROLLOUT-CHECKLIST.md)   | Operators — literal migration, webhook, delivery/bounce smoke and rollback checklist (LT)            |
| [docs/PILOT-OPERATIONS-RUNBOOK.md](./docs/PILOT-OPERATIONS-RUNBOOK.md)   | Operators — first paid pilot scope, go/no-go, incidents, backup, DSR and monitoring (LT)             |
| [docs/LEGAL-READINESS-CHECKLIST.md](./docs/LEGAL-READINESS-CHECKLIST.md) | Product/legal — approved inputs and hard release gate before a paid/public pilot (LT)                |
| [docs/NAUDOTOJO-GIDAS.md](./docs/NAUDOTOJO-GIDAS.md)                     | Business users — how to use the dashboard (LT)                                                       |
| [docs/DEPLOY-RAILWAY.md](./docs/DEPLOY-RAILWAY.md)                       | Operators — step-by-step Railway deployment, migrations, seed, troubleshooting (LT)                  |

---

## Tech stack

| Concern     | Choice                                     |
| ----------- | ------------------------------------------ |
| Framework   | Next.js 15 (App Router)                    |
| Language    | TypeScript (strict)                        |
| Styling     | Tailwind CSS v3                            |
| Validation  | Zod (shared client + server schema)        |
| Lead intake | Signed HTTP + verified Resend inbound      |
| Product DB  | Prisma + PostgreSQL                        |
| Linting     | ESLint (`next/core-web-vitals`) + Prettier |
| Deployment  | Railway (Railpack)                         |

No paid UI libraries. Runtime data comes from PostgreSQL; the optional seed
creates an explicitly labelled DEV client and configuration.

---

## Project structure

```txt
.
├── app
│   ├── api/leads/route.ts       # Landing contact form (not product inbound)
│   ├── api/integrations         # Signed web form + verified Resend inbound/delivery
│   ├── api/dashboard/test       # Test lead API, DB-backed
│   ├── auth                     # Login/signup server actions
│   ├── dashboard                # Client dashboard, test tool, configuration
│   ├── privatumas/page.tsx      # Privacy information (noindex)
│   ├── salygos/page.tsx         # Terms placeholder page (noindex)
│   ├── globals.css
│   ├── icon.svg                 # Favicon
│   ├── layout.tsx               # Root layout, SEO + OpenGraph metadata
│   ├── page.tsx                 # Landing page composition
│   ├── robots.ts                # /robots.txt
│   └── sitemap.ts               # /sitemap.xml
├── components
│   ├── landing/                 # Section components (Header, Hero, ...)
│   └── ui/                      # Button, Card, Section primitives
├── lib
│   ├── ai/                      # AI gap filling, shadow and offering helpers
│   ├── auth/                    # Passwords, sessions, redirects
│   ├── inbound/                 # Auth, routing, idempotency, adapters, conversations
│   ├── outbound/                # Sender identity, idempotent send and delivery tracking
│   ├── leads/                   # Lead queries, parsing, and shared pipeline
│   ├── outbound/                # Resend identity, send guards and idempotent dispatch
│   ├── rules/                   # Rules loading and response decisions
│   ├── constants.ts             # All Lithuanian copy + config
│   ├── lead-schema.ts           # Zod lead schema (shared)
│   └── utils.ts                 # cn(), getSiteUrl()
├── prisma                       # Prisma schema + PostgreSQL migrations
├── public/opengraph-image.svg   # Social share image
├── .env.example
├── railway.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
└── prettier.config.mjs
```

---

## Local development

Requirements: **Node.js 20.x** and npm. The same major version is pinned in
`package.json` and `.nvmrc` so local and Railway builds use the same runtime.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Then open <http://localhost:3000>.

### Test a production build locally

```bash
npm run build
npm run start
```

`next start` listens on `process.env.PORT` (defaults to `3000`), so it works
locally and on Railway without changes.

### Useful scripts

| Command                    | What it does                     |
| -------------------------- | -------------------------------- |
| `npm run dev`              | Start dev server (hot reload)    |
| `npm run build`            | Production build                 |
| `npm run start`            | Serve the production build       |
| `npm run test`             | Run server-side logic tests      |
| `npm run db:generate`      | Generate Prisma Client           |
| `npm run db:migrate`       | Apply Prisma migrations          |
| `npm run db:seed`          | Upsert the labelled DEV config   |
| `npm run db:shadow-report` | Summarize stored shadow diffs    |
| `npm run lint`             | Run ESLint                       |
| `npm run typecheck`        | Type-check with no emit          |
| `npm run format`           | Format all files with Prettier   |
| `npm run format:check`     | Check formatting without writing |

---

## Environment variables

Copy `.env.example` → `.env.local` for local dev. In Railway, set these in the
service **Variables** tab.

| Variable                        | Required      | Scope       | Description                                                                                                                          |
| ------------------------------- | ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`          | Yes           | Public      | Public base URL, no trailing slash. Used for SEO metadata, OpenGraph, robots.txt, sitemap.xml.                                       |
| `LEAD_WEBHOOK_URL`              | No            | Server only | If set, lead submissions are POSTed here (Make/Zapier/n8n/Slack/CRM). If empty, leads are only logged server-side.                   |
| `DATABASE_URL`                  | Dashboard     | Server only | PostgreSQL connection string used by Prisma. Dashboard routes fail clearly without it.                                               |
| `SUPER_ADMIN_SIGNUP_CODE`       | Admin setup   | Server only | Secret required by `/super-admin/signup`. Use at least 24 random characters and rotate it after setup.                               |
| `OPENAI_API_KEY`                | Lead pipeline | Server only | Required because every test and product-inbound lead starts with LLM-first parsing. Missing config routes the lead to manual review. |
| `OPENAI_MODEL`                  | Lead pipeline | Server only | Exact model ID used by the OpenAI Responses API; no application default is assumed.                                                  |
| `SHADOW_AI_PARSE`               | No            | Server only | `true` adds a measurement-only AI comparison to `/dashboard/test`; inbound forces it off.                                            |
| `INBOUND_SIGNING_MASTER_SECRET` | Inbound       | Server only | Master secret (at least 32 random bytes) used to derive each web-form integration's versioned signing secret.                        |
| `RESEND_API_KEY`                | Email         | Server only | Retrieves verified inbound email and provisions/sends from client-verified outbound domains.                                         |
| `RESEND_WEBHOOK_SECRET`         | Email         | Server only | Verifies the exact raw Resend/Svix inbound and delivery webhook payload.                                                             |
| `RESEND_INBOUND_DOMAIN`         | Paslaugos.lt  | Server only | Verified Resend receiving domain used for unique `p-…@domain` routing addresses.                                                     |
| `EMAIL_SENDING_ENABLED`         | Outbound      | Server only | Global kill switch for human-approved Resend sends; defaults to `false`.                                                             |
| `NODE_ENV`                      | Auto          | Server      | `development` locally; Railway build/start commands force `production`. Do not create this variable manually in Railway.             |

> **Security:** `LEAD_WEBHOOK_URL`, `SUPER_ADMIN_SIGNUP_CODE`,
> `INBOUND_SIGNING_MASTER_SECRET`, `RESEND_API_KEY`, and
> `RESEND_WEBHOOK_SECRET` are server-only secrets — never prefix them with
> `NEXT_PUBLIC_` or expose them to the browser. Per-integration web-form
> signing secrets may be copied from the authenticated dashboard only into a
> trusted server-side sender.

Product inbound is separate from the landing contact form and
`LEAD_WEBHOOK_URL`. Configure supported sources in `/dashboard/integrations`.
Do not forward a complete customer mailbox: each Paslaugos.lt integration uses
a precise mail rule that forwards only Paslaugos.lt notifications. See
[the inbound integration runbook](./docs/INBOUND-INTEGRATION.md).

The runtime parse path is no longer configurable:

| Flow                                         | Active parse path                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `/dashboard/test`                            | Always LLM-first, then code validation/resolution/decision/composition.   |
| Product inbound (`WEB_FORM`, `PASLAUGOS_LT`) | The same mandatory LLM-first path. Shadow comparison remains disabled.    |
| Public landing `POST /api/leads`             | No product pipeline; log and optional `LEAD_WEBHOOK_URL` forwarding only. |

`LLM_FIRST_PARSE` is retired and no longer read. A stale Railway/local value
can be deleted; `false` does not restore the old runtime path.

### How lead capture works

The "Gauti pasiūlymą" form posts to `POST /api/leads`. The route:

1. Validates the payload with the shared Zod schema.
2. Rejects spam via a hidden honeypot field.
3. Logs the lead server-side (so it is never lost).
4. If `LEAD_WEBHOOK_URL` is set, forwards the lead to that webhook.
5. Returns success to the visitor.

The webhook is **optional**. Without it, leads still succeed and appear in your
Railway deploy logs. To collect them somewhere, create a webhook in Make.com,
Zapier, n8n, or a Slack incoming webhook and paste the URL into
`LEAD_WEBHOOK_URL`.

### Dashboard database

The dashboard and test tool use real PostgreSQL data through Prisma. Nothing is
seeded automatically; `npm run db:seed` explicitly upserts the labelled DEV
client and its rules for controlled testing.

```bash
npm run db:generate
npm run db:migrate
```

Visit `/signup` to create a new company, client, and owner account. Every
signup creates a separate client. To administer the existing seeded client
`id=1`, configure `SUPER_ADMIN_SIGNUP_CODE`, create an account at
`/super-admin/signup`, and select that client in the dashboard. If the selected
client has no active services and rules, `/dashboard/test` shows the empty
state and does not allow testing.

---

## Git workflow

```bash
git init
git add .
git commit -m "Initial landing page"
```

Then create a repository on GitHub (empty, no README) and push:

```bash
# Replace with your repo URL
git remote add origin git@github.com:YOUR_USERNAME/firstreply.git
git branch -M main
git push -u origin main
```

**Suggested first commit message:** `Initial landing page`

Day-to-day:

```bash
git checkout -b feature/my-change
# ...edit...
npm run lint && npm run typecheck && npm run build
git commit -am "Describe your change"
git push -u origin feature/my-change
# open a Pull Request on GitHub
```

Never commit `.env.local` — it is already in `.gitignore`.

---

## Deploy to Railway

Railway builds this project with **Railpack** (auto-detects Next.js). Config is
in [`railway.json`](./railway.json): Node `20.x`, build with
`NODE_ENV=production npm run build`, and start with
`NODE_ENV=production npm run start`.

1. Push the repo to GitHub (see **Git workflow** above).
2. Go to <https://railway.com> → **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway detects Next.js and reads `railway.json`.
4. Open the service → **Variables** and configure the values listed in
   [the Railway runbook](./docs/DEPLOY-RAILWAY.md). `OPENAI_API_KEY` and
   `OPENAI_MODEL` are required for every product lead; `LLM_FIRST_PARSE` is
   retired and should be removed.
5. Railway assigns `PORT` automatically; `next start` reads it — nothing to
   configure. Do not create `NODE_ENV` manually; remove a stale `prod`,
   `staging`, or other non-standard value if one exists.
6. (Optional) **Settings → Networking → Generate Domain** for a public URL, or
   attach a custom domain. After setting the final domain, update
   `NEXT_PUBLIC_SITE_URL` and redeploy so SEO metadata and the sitemap use it.

> If `NEXT_PUBLIC_SITE_URL` changes, redeploy so the build picks up the new
> value in metadata, `robots.txt`, and `sitemap.xml`.

---

## Current boundaries and next work

- Add email verification, password reset, invitations, and additional company
  members to the existing authentication flow.
- The public lead API route is still the launch/contact intake. Product leads
  live in the Prisma `leads` table.
- All copy lives in `lib/constants.ts`; the lead contract lives in
  `lib/lead-schema.ts`.

Additional source adapters, CRM, Gmail/Microsoft mailbox sync, customer reply
routing, multiple users, and advanced reports remain roadmap items. Human-
approved Web form email sending and delivery tracking exist; automatic sending
does not. Source count is not limited in V1; usage is measured per integration
for future pricing decisions.
