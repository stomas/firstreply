# Super Admin System Config MVP 1 Implementation Plan

> **Status:** istorinis 2026-07-09 įgyvendinimo planas. Dabartinę System Config
> būseną žr. [`docs/ARCHITEKTURA.md`](../../ARCHITEKTURA.md) ir
> [`docs/NAUDOTOJO-GIDAS.md`](../../NAUDOTOJO-GIDAS.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Super Admin MVP for current-client subjects, advanced requirements, pricing builder config, access gating, navigation, status summary, and safe reference guards.

**Architecture:** Add a focused `lib/dashboard/super-admin.ts` module for feature flag checks, pure parsers/builders, supported JSON detection, read models, and DB mutations. Add a single `/dashboard/super-admin` dashboard route plus colocated server actions; reuse existing dashboard server component and redirect-query patterns.

**Tech Stack:** Next.js App Router server components/actions, Prisma, TypeScript, `node:test`, existing Tailwind dashboard styles.

---

### Task 1: Pure Helpers And Navigation

**Files:**

- Create: `tests/dashboard-super-admin.test.ts`
- Create: `lib/dashboard/super-admin.ts`
- Modify: `lib/dashboard/navigation.ts`
- Modify: `components/dashboard/DashboardSidebar.tsx`
- Modify: `tests/dashboard-navigation.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that import the future Super Admin helpers and assert:

```ts
assert.equal(isSuperAdminEnabled({ NODE_ENV: "development" }), true);
assert.equal(isSuperAdminEnabled({ NODE_ENV: "production" }), false);
assert.equal(
  isSuperAdminEnabled({ NODE_ENV: "production", SUPER_ADMIN_ENABLED: "true" }),
  true,
);
assert.deepEqual(parseSubjectForm(subjectForm()).value.synonyms, [
  "tvora",
  "segmentai",
]);
assert.deepEqual(parseAdvancedRequirementForm(requirementForm()).value, {
  requirementId: "req_1",
  requirementKey: "fence_height",
  label: "Tvoros aukštis",
  question: "Kokio aukščio tvoros reikia?",
  expectedKind: "measurement",
  subjectKey: "fence",
  dimension: "height",
  units: ["m"],
  validationMin: 1,
  validationMax: 3,
  required: true,
  affectsPrice: true,
  active: true,
  priority: 20,
});
assert.deepEqual(parsePricingBuilderForm(pricingForm()).value.modifiers, [
  {
    requirementKey: "fence_height",
    gte: 1.7,
    pricePerUnitDelta: 6,
  },
]);
assert.equal(describePricingRuleSupport({ type: "per_unit" }).supported, true);
assert.equal(describePricingRuleSupport({ type: "custom" }).supported, false);
```

Update navigation tests to call the future `getDashboardNavigationSections()` with explicit env maps and assert Super Admin appears only when enabled.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/dashboard-super-admin.test.ts tests/dashboard-navigation.test.ts
```

Expected: FAIL because the new module and navigation API do not exist yet.

- [ ] **Step 3: Implement helpers and navigation**

Create the module with `isSuperAdminEnabled`, subject parser, advanced requirement parser, pricing builder parser, JSON builders, support detection, and status summarizers. Keep functions pure where possible. Add `getDashboardNavigationSections(env = process.env)` and make the sidebar call it.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test -- tests/dashboard-super-admin.test.ts tests/dashboard-navigation.test.ts
```

Expected: PASS.

### Task 2: Super Admin Data And Actions

**Files:**

- Modify: `lib/dashboard/super-admin.ts`
- Create: `app/dashboard/super-admin/actions.ts`

- [ ] **Step 1: Write failing action-level helper tests**

Extend helper tests for duplicate-key validation, subject delete guard, requirement-key pricing references, generated pricing JSON, and unsupported JSON counts.

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/dashboard-super-admin.test.ts
```

Expected: FAIL until validation helpers exist.

- [ ] **Step 3: Implement DB-facing helpers and server actions**

Add `getSuperAdminConfig`, `create/update/deleteSubject`, `create/update/deactivateRequirement`, and `create/update/deactivatePricingRule`. Mutations must scope through the current client, block reference-breaking operations, revalidate `/dashboard/super-admin`, and redirect with `updated`, `deleted`, or `error`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
npm test -- tests/dashboard-super-admin.test.ts
```

Expected: PASS.

### Task 3: Route UI

**Files:**

- Create: `app/dashboard/super-admin/page.tsx`

- [ ] **Step 1: Implement route gate**

At page load, call `isSuperAdminEnabled()`. If false, call `notFound()`.

- [ ] **Step 2: Implement index page**

Render seed reset warning, status summary, service-grouped subjects, advanced requirements, pricing rules, read-only JSON previews, unsupported labels, and inline structured create/edit forms. Use existing dashboard card/button styling and `DashboardError`.

- [ ] **Step 3: Add actions to forms**

Wire each form to the Super Admin actions. Use hidden IDs for edit forms, repeatable modifier rows with a fixed small MVP count, and destructive/deactivation controls with clear button labels.

- [ ] **Step 4: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

### Task 4: Verification

**Files:**

- All touched files.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run isolated build**

Run:

```bash
NEXT_DIST_DIR=.next-build npm run build
```

Expected: PASS.
