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

This repository contains the landing page plus the first minimal product
surface: a DB-backed client dashboard and test tool. It still intentionally
does not include auth, payments, CRM, or advanced integrations.

---

## Tech stack

| Concern     | Choice                                     |
| ----------- | ------------------------------------------ |
| Framework   | Next.js 15 (App Router)                    |
| Language    | TypeScript (strict)                        |
| Styling     | Tailwind CSS v3                            |
| Validation  | Zod (shared client + server schema)        |
| Lead intake | API route + optional webhook               |
| Product DB  | Prisma + PostgreSQL                        |
| Linting     | ESLint (`next/core-web-vitals`) + Prettier |
| Deployment  | Railway (Nixpacks)                         |

No paid UI libraries and no mock product data.

---

## Project structure

```txt
.
├── app
│   ├── api/leads/route.ts       # Lead intake API (validation + optional webhook)
│   ├── api/dashboard/test       # Test lead API, DB-backed
│   ├── dashboard                # Minimal client dashboard and test tool
│   ├── privatumas/page.tsx      # Privacy placeholder page (noindex)
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
│   ├── leads/                   # Lead queries, parsing, and test flow
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

| Variable                       | Required  | Scope       | Description                                                                                                        |
| ------------------------------ | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`         | Yes       | Public      | Public base URL, no trailing slash. Used for SEO metadata, OpenGraph, robots.txt, sitemap.xml.                     |
| `LEAD_WEBHOOK_URL`             | No        | Server only | If set, lead submissions are POSTed here (Make/Zapier/n8n/Slack/CRM). If empty, leads are only logged server-side. |
| `DATABASE_URL`                 | Dashboard | Server only | PostgreSQL connection string used by Prisma. Dashboard routes fail clearly without it.                             |
| `FIRSTREPLY_DEFAULT_CLIENT_ID` | Dashboard | Server only | Temporary server-side client resolution until auth exists. Must match a real `clients.id`.                         |
| `OPENAI_API_KEY`               | Test tool | Server only | Required for AI draft generation. If missing, test responses go to manual review with a clear error.               |
| `OPENAI_MODEL`                 | Test tool | Server only | Required with `OPENAI_API_KEY`; no default model is assumed.                                                       |
| `NODE_ENV`                     | Auto      | Server      | `development` locally; Railway sets `production` automatically.                                                    |

> **Security:** `LEAD_WEBHOOK_URL` is a server-only secret — it is never
> prefixed with `NEXT_PUBLIC_` and never sent to the browser. Do not put
> secrets in `NEXT_PUBLIC_*` variables.

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

Until auth exists, set `FIRSTREPLY_DEFAULT_CLIENT_ID` to an existing
`clients.id`. If there are no active services and rules for that client,
`/dashboard/test` shows the empty state and does not allow testing.

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

- Add authenticated app routes under `app/(app)/…` or wire auth into the
  existing dashboard client resolution.
- The public lead API route is still the launch/contact intake. Product leads
  live in the Prisma `leads` table.
- All copy lives in `lib/constants.ts`; the lead contract lives in
  `lib/lead-schema.ts`.

Pro plan features (more sources, CRM, Gmail/Microsoft, multiple users, advanced
reports) are shown as "Greit bus" only and are intentionally **not**
implemented.
