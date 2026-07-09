# Super Admin Operational Config MVP 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/dashboard/super-admin` with tenant-level operational config for location zones, schedule rules, autosend policy, and response templates.

**Architecture:** Keep MVP 1 core decision config in `lib/dashboard/super-admin.ts` and add a focused `lib/dashboard/super-admin-operational.ts` module for tenant-scoped operational read models, pure parsers/builders, JSON support detection, and DB mutations. Reuse the existing Super Admin page and actions pattern, adding a top-level Operational Config block that is separate from service-level collapsed blocks.

**Tech Stack:** Next.js App Router server components/actions, Prisma, TypeScript, `node:test`, existing Tailwind dashboard form styles.

---

### Task 1: Operational Pure Helpers

**Files:**

- Create: `tests/dashboard-super-admin-operational.test.ts`
- Create: `lib/dashboard/super-admin-operational.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

- `parseLocationZoneForm` trims fields, parses Lithuanian comma decimals, and requires `adminUnitCode`.
- `parseScheduleRuleForm` accepts `minWeeks=3`, `maxWeeks=5`, and rejects `min > max`.
- `describeScheduleRuleSupport` accepts only `{ type: "lead_time_weeks", min, max }`.
- `parseAutosendPolicyForm` builds the current policy shape and defaults missing policy creation to `enabled=false`.
- `describeAutosendPolicySupport` treats malformed/unsupported JSON as unsafe.
- `parseResponseTemplateForm` validates slug-like `templateKey` and required body.
- `responseTemplateWarningForKey` warns for decision template keys.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/dashboard-super-admin-operational.test.ts
```

Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Implement minimal helpers**

Create exported form types, parser functions, JSON builders, support detection, default autosend policy builder, response template placeholder hints, and small row conversion helpers. Keep DB calls out of the first implementation pass except for type-compatible shapes.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test -- tests/dashboard-super-admin-operational.test.ts
```

Expected: PASS.

### Task 2: Tenant Read Model And Mutations

**Files:**

- Modify: `lib/dashboard/super-admin-operational.ts`
- Modify: `app/dashboard/super-admin/actions.ts`

- [ ] **Step 1: Write failing DB-boundary helper tests**

Extend tests for summarizing operational config and safe defaults without connecting to the DB. Assert unsupported schedule/policy counts and active template counts.

- [ ] **Step 2: Implement read model**

Add `getSuperAdminOperationalConfig(client)` or `getSuperAdminOperationalConfig(clientId)` that resolves the current client's `tenantId`, returns `{ tenantId: null }` if missing, and otherwise reads:

- `locationZones`
- `scheduleRules`
- first `autosendPolicy`
- `responseTemplates`

Rows should include read-only JSON previews and support labels for schedule/policy JSON.

- [ ] **Step 3: Implement mutations**

Add create/update/delete location zone, create/update/delete schedule rule, save autosend policy, create/update/deactivate response template. All mutations must verify tenant ownership through the current client and return `{ ok: false, error }` instead of throwing for missing tenant or records.

- [ ] **Step 4: Wire server actions**

Add server actions that parse forms, call operational mutations, revalidate `/dashboard/super-admin` and `/dashboard/test`, then redirect with `updated`, `deleted`, or `error`.

### Task 3: Operational Config UI

**Files:**

- Modify: `app/dashboard/super-admin/page.tsx`

- [ ] **Step 1: Load operational config**

After loading the current client and MVP 1 config, load the operational config and pass it to a new `OperationalConfigPanel`.

- [ ] **Step 2: Add Location Zones UI**

Render list/create/edit/delete forms with fields:

- admin unit code
- zone
- travel fee EUR
- served

Use hard delete with confirmation because `LocationZone` has no `active` field.

- [ ] **Step 3: Add Schedule Rules UI**

Render list/create/edit/delete forms for supported `lead_time_weeks` rules and show unsupported schedule JSON read-only without crashing.

- [ ] **Step 4: Add Autosend Policy UI**

Render one policy form. If missing, show a create-safe form with `enabled=false`. If unsupported/malformed, show warning and allow replacement with the supported builder shape.

- [ ] **Step 5: Add Response Templates UI**

Render list/create/edit/deactivate forms with placeholder hints for known keys and warnings for decision template keys.

### Task 4: Docs And Verification

**Files:**

- Modify: `docs/ARCHITEKTURA.md`
- Modify: `docs/NAUDOTOJO-GIDAS.md`
- Modify: `docs/DEPLOY-RAILWAY.md` if env/deploy behavior changes
- Modify: `.env.example` only if new env vars are introduced

- [ ] **Step 1: Update docs**

Document that Super Admin MVP 2 now covers tenant-level operational config, autosend safety defaults, response template placeholders, and seed reset caveats.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- tests/dashboard-super-admin-operational.test.ts tests/dashboard-super-admin.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
NEXT_DIST_DIR=.next-build npm run build
npx prettier --check app/dashboard/super-admin/page.tsx app/dashboard/super-admin/actions.ts lib/dashboard/super-admin-operational.ts tests/dashboard-super-admin-operational.test.ts docs/ARCHITEKTURA.md docs/NAUDOTOJO-GIDAS.md docs/DEPLOY-RAILWAY.md
```

Expected: all commands PASS.
