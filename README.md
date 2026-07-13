# FirstReply — landing page

Production-ready Lithuanian landing page for **FirstReply**
([firstreply.lt](https://firstreply.lt)), a micro-SaaS that helps small
Lithuanian service and installation businesses respond to written inquiries
faster (terrace builders, fence installers, carport/canopy builders, gate
installers, and standard installation providers).

The system helps them reply faster to **website form** and **Paslaugos.lt**
inquiries with an indicative price, the missing information needed for an
accurate quote, a preliminary work-start window, and one follow-up — while
keeping final quotes and dates under the owner's control.

This repository contains the landing page plus an authenticated, DB-backed
client dashboard, response pipeline, and source-specific inbound integrations.
V1 accepts signed web-form events and Paslaugos.lt notifications routed through
dedicated Resend addresses. It intentionally does not include payments, CRM,
Gmail mailbox sync, or outbound sending.

## Documentation

| Document                                                     | Audience                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [docs/ARCHITEKTURA.md](./docs/ARCHITEKTURA.md)               | Developers — pipeline, decision engine, AI integration, DB models, known limitations (LT) |
| [docs/INBOUND-INTEGRATION.md](./docs/INBOUND-INTEGRATION.md) | Developers/operators — web-form signing, Resend routing, retry and smoke tests (LT)       |
| [docs/NAUDOTOJO-GIDAS.md](./docs/NAUDOTOJO-GIDAS.md)         | Business users — how to use the dashboard (LT)                                            |
| [docs/DEPLOY-RAILWAY.md](./docs/DEPLOY-RAILWAY.md)           | Operators — step-by-step Railway deployment, migrations, seed, troubleshooting (LT)       |

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
| Deployment  | Railway (Nixpacks)                         |

No paid UI libraries and no mock product data.

---

## Project structure

```txt
.
├── app
│   ├── api/leads/route.ts       # Landing contact form (not product inbound)
│   ├── api/integrations/inbound # Signed web form + verified Resend inbound
│   ├── api/dashboard/test       # Test lead API, DB-backed
│   ├── dashboard                # Minimal client dashboard and test tool
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
│   ├── ai/                      # Server-side response generation gate
│   ├── inbound/                 # Auth, routing, idempotency, adapters, conversations
│   ├── leads/                   # Lead queries, parsing, and shared pipeline
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

Requirements: **Node.js 18.18+** (Node 20 LTS recommended) and npm.

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

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start dev server (hot reload)    |
| `npm run build`        | Production build                 |
| `npm run start`        | Serve the production build       |
| `npm run test`         | Run server-side logic tests      |
| `npm run db:generate`  | Generate Prisma Client           |
| `npm run db:migrate`   | Apply Prisma migrations          |
| `npm run lint`         | Run ESLint                       |
| `npm run typecheck`    | Type-check with no emit          |
| `npm run format`       | Format all files with Prettier   |
| `npm run format:check` | Check formatting without writing |

---

## Environment variables

Copy `.env.example` → `.env.local` for local dev. In Railway, set these in the
service **Variables** tab.

| Variable                        | Required     | Scope       | Description                                                                                                        |
| ------------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`          | Yes          | Public      | Public base URL, no trailing slash. Used for SEO metadata, OpenGraph, robots.txt, sitemap.xml.                     |
| `LEAD_WEBHOOK_URL`              | No           | Server only | If set, lead submissions are POSTed here (Make/Zapier/n8n/Slack/CRM). If empty, leads are only logged server-side. |
| `DATABASE_URL`                  | Dashboard    | Server only | PostgreSQL connection string used by Prisma. Dashboard routes fail clearly without it.                             |
| `SUPER_ADMIN_SIGNUP_CODE`       | Admin setup  | Server only | Secret required by `/super-admin/signup`. Use at least 24 random characters and rotate it after setup.             |
| `OPENAI_API_KEY`                | Test tool    | Server only | Required for AI draft generation. If missing, test responses go to manual review with a clear error.               |
| `OPENAI_MODEL`                  | Test tool    | Server only | Required with `OPENAI_API_KEY`; no default model is assumed.                                                       |
| `LLM_FIRST_PARSE`               | No           | Server only | `true` enables the dashboard test tool's LLM-first parser. Default `false` keeps the deterministic parser.         |
| `SHADOW_AI_PARSE`               | No           | Server only | `true` enables measurement-only shadow AI parse. It never affects decisions.                                       |
| `INBOUND_SIGNING_MASTER_SECRET` | Inbound      | Server only | Master secret (at least 32 random bytes) used to derive each web-form integration's versioned signing secret.      |
| `RESEND_API_KEY`                | Paslaugos.lt | Server only | Retrieves a verified inbound email from Resend after `email.received`.                                             |
| `RESEND_WEBHOOK_SECRET`         | Paslaugos.lt | Server only | Verifies the exact raw Resend/Svix webhook payload.                                                                |
| `RESEND_INBOUND_DOMAIN`         | Paslaugos.lt | Server only | Verified Resend receiving domain used for unique `p-…@domain` routing addresses.                                   |
| `NODE_ENV`                      | Auto         | Server      | `development` locally; Railway sets `production` automatically.                                                    |

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

The dashboard and test tool use real PostgreSQL data through Prisma. They do
not seed mock clients, rules, leads, or responses.

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

Railway builds this project with **Nixpacks** (auto-detects Next.js). Config is
in [`railway.json`](./railway.json): build with `npm run build`, start with
`npm run start`.

1. Push the repo to GitHub (see **Git workflow** above).
2. Go to <https://railway.app> → **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway detects Next.js and reads `railway.json`.
4. Open the service → **Variables** and add:
   - `NEXT_PUBLIC_SITE_URL` = your public URL (e.g. `https://your-app.up.railway.app`,
     or your custom domain once attached). No trailing slash.
   - `LEAD_WEBHOOK_URL` = your webhook URL (optional — leave empty to skip).
   - `NODE_ENV` is set to `production` by Railway automatically.
5. Railway assigns `PORT` automatically; `next start` reads it — nothing to
   configure.
6. (Optional) **Settings → Networking → Generate Domain** for a public URL, or
   attach a custom domain. After setting the final domain, update
   `NEXT_PUBLIC_SITE_URL` and redeploy so SEO metadata and the sitemap use it.

> If `NEXT_PUBLIC_SITE_URL` changes, redeploy so the build picks up the new
> value in metadata, `robots.txt`, and `sitemap.xml`.

---

## Extending into the real product later

The skeleton keeps future work easy:

- Add email verification, password reset, invitations, and additional company
  members to the existing authentication flow.
- The public lead API route is still the launch/contact intake. Product leads
  live in the Prisma `leads` table.
- All copy lives in `lib/constants.ts`; the lead contract lives in
  `lib/lead-schema.ts`.

Additional source adapters, CRM, Gmail/Microsoft mailbox sync, outbound
sending, multiple users, and advanced reports remain roadmap items. Source
count is not limited in V1; usage is measured per integration for future
pricing decisions.
