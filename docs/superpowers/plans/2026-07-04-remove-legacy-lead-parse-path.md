# Remove Legacy Lead Parse Path Implementation Plan

> **Status:** istorinis 2026-07-04 įgyvendinimo planas. Jis nekeičiamas į
> dabartinės sistemos specifikaciją; aktyvų pipeline žr.
> [`docs/ARCHITEKTURA.md`](../../ARCHITEKTURA.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lead_parse_v2` facts and `expectedFact` the only active parsing/pricing path for the dev client.

**Architecture:** Remove legacy `fence_length_m` compatibility from parsed lead JSON, remove legacy `req_dev_*` and `price_dev_*` seed data from the database, and simplify evaluation so each active requirement is resolved directly. Keep `availability_rules` in place until the v2 location/schedule resolver is implemented, because the dashboard still depends on it.

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Node `node:test`.

---

### Task 1: Parser Contract

**Files:**

- Modify: `tests/parse-lead.test.ts`
- Modify: `lib/leads/parse-lead.ts`

- [x] **Step 1: Write failing parser test**

Replace the legacy assertion with checks that `facts[]` contains the length and no `fence_length_m` compatibility key is emitted.

- [x] **Step 2: Run tests to verify failure**

Run: `npm run test`

Expected: fail because `parseTestInquiryLead()` still emits `fence_length_m`.

- [x] **Step 3: Remove parser compatibility field**

Remove `fence_length_m` from `ParsedLeadData`, remove `extractLegacyLengthMeters()`, and return only v2 fields.

- [x] **Step 4: Run tests to verify pass**

Run: `npm run test`

Expected: parser tests pass.

### Task 2: Evaluation Without Legacy Grouping

**Files:**

- Modify: `tests/evaluate-lead-for-response.test.ts`
- Modify: `lib/rules/evaluate-lead-for-response.ts`

- [x] **Step 1: Remove legacy-equivalence tests**

Delete tests that intentionally mix `fence_height_m` with `fence_height`.

- [x] **Step 2: Simplify requirement loop**

Evaluate each active requirement directly through `hasRequirementValue()`. Remove label grouping helpers.

- [x] **Step 3: Run tests**

Run: `npm run test`

Expected: all tests pass.

### Task 3: Database Cleanup

**Files:**

- Create: `prisma/migrations/20260704195500_remove_legacy_dev_rules/migration.sql`
- Modify: `prisma/seed.ts`

- [x] **Step 1: Add migration**

Delete `decision_requirements` rows with `id LIKE 'req_dev_%'` and `pricing_rules` rows with `id LIKE 'price_dev_%'` for `client_id = '1'`.

- [x] **Step 2: Add seed cleanup**

Make `prisma/seed.ts` delete the same legacy rows before upserting v2 requirements/pricing so they do not come back.

- [x] **Step 3: Apply migration and seed**

Run: `npm run db:migrate && npm run db:seed`

Expected: no `req_dev_*` or `price_dev_*` rows remain.

### Task 4: Verification

**Files:**

- Verify only.

- [x] **Step 1: Run automated verification**

Run: `npm run test`, `npm run typecheck`, `npx prisma validate`, `npm run lint`, `npm run build`.

- [x] **Step 2: Restart dev server**

Restart `npm run dev` on port 3000 after build.

- [x] **Step 3: Browser check**

Submit `/dashboard/test` with `45 m` and `1.7m aukščio`.

Expected: no missing `Tvoros ilgis` or `Tvoros aukštis`; remaining manual review is only from unconfigured AI or other still-required v2 fields.
