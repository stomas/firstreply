# Deterministic Extractor Implementation Plan

> **Status:** istorinis 2026-07-04 įgyvendinimo planas. Jis nekeičiamas į
> dabartinės sistemos specifikaciją; aktyvų pipeline žr.
> [`docs/ARCHITEKTURA.md`](../../ARCHITEKTURA.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `lead_parse_v2` deterministic extraction slice: contacts, LT admin units, intents, measurements, ranges, quantities, raw evidence, and negation markers.

**Architecture:** Add a standalone extractor in `lib/extractor/deterministic.ts` with closed TypeScript types in `lib/extractor/types.ts`. Keep it independent from AI, resolver, and rules engine. Wire `parseTestInquiryLead()` to call the extractor only for backwards-compatible fields used by the current dashboard.

**Tech Stack:** Next.js/TypeScript, Node `node:test`, local JSON dictionary `data/lt_admin_units.json`, no production mocks.

---

### Task 1: Extractor Unit Tests

**Files:**

- Create: `tests/deterministic-extractor.test.ts`
- Read: `data/lt_admin_units.json`

- [x] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDeterministicFacts } from "../lib/extractor/deterministic";

describe("extractDeterministicFacts", () => {
  it("extracts phone before measurements so phone digits are not measurements", () => {
    const result = extractDeterministicFacts(
      "Tel 860000000, reikia tvoros 45 m.",
    );
    assert.equal(result.contacts.phone?.normalized, "+37060000000");
    assert.deepEqual(
      result.facts
        .filter((fact) => fact.kind === "measurement")
        .map((fact) => fact.value),
      [45],
    );
  });

  it("normalizes Vilniaus rajonas to the municipality, not Vilnius city", () => {
    const result = extractDeterministicFacts(
      "Sveiki, reiktu tvoros 45 metrai, vilniaus rajone.",
    );
    assert.equal(result.location?.adminUnit.code, "vilniaus_r_sav");
    assert.equal(result.location?.adminUnit.label, "Vilniaus r. sav.");
  });

  it("extracts decimal and area measurements with Lithuanian units", () => {
    const result = extractDeterministicFacts("Terasa 120 kv.m, aukštis 1,5 m.");
    const area = result.facts.find((fact) => fact.dimension === "area");
    const height = result.facts.find((fact) => fact.dimension === "height");
    assert.equal(area?.value, 120);
    assert.equal(area?.unit, "m2");
    assert.equal(height?.value, 1.5);
    assert.equal(height?.unit, "m");
  });

  it("extracts ranges and approximate values", () => {
    const result = extractDeterministicFacts(
      "tvora apie 40-50 metru, kaunas, skubiai",
    );
    const range = result.facts.find((fact) => fact.kind === "measurement");
    assert.equal(range?.value, null);
    assert.equal(range?.valueMin, 40);
    assert.equal(range?.valueMax, 50);
    assert.equal(range?.confidence, 0.9);
    assert.equal(result.intents.isUrgent, true);
  });

  it("extracts Lithuanian word-number quantities", () => {
    const result = extractDeterministicFacts(
      "reikia trys varteliai ir 2 vartai",
    );
    const quantities = result.facts.filter((fact) => fact.kind === "quantity");
    assert.deepEqual(
      quantities.map((fact) => fact.value),
      [3, 2],
    );
  });

  it("marks negated facts and does not use units when they are missing", () => {
    const result = extractDeterministicFacts("vartų nereikia, tik tvora 30");
    assert.equal(
      result.facts.some((fact) => fact.negated),
      true,
    );
    assert.equal(
      result.facts.some((fact) => fact.kind === "measurement"),
      false,
    );
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm run test`

Expected: fail because `../lib/extractor/deterministic` does not exist.

### Task 2: Extractor Types and Implementation

**Files:**

- Create: `lib/extractor/types.ts`
- Create: `lib/extractor/deterministic.ts`
- Modify: `lib/leads/parse-lead.ts`

- [x] **Step 1: Add extractor types**

Create `lib/extractor/types.ts` with enums/unions for `ExtractedFact`, `DeterministicExtractionResult`, contacts, location, intents, and the exact `lead_parse_v2` fields used by the deterministic slice.

- [x] **Step 2: Implement minimal extractor**

Create `lib/extractor/deterministic.ts` that:

- loads `data/lt_admin_units.json`;
- extracts phone/email first and masks spans;
- extracts location by alias;
- extracts intents;
- extracts measurements with `m`, `m2`, decimal comma, ranges, approximate confidence;
- extracts quantities with digits and LT word numbers 1-20;
- sets `subject: null` unless a future form-field mapping supplies it;
- stores `rawText` as nearby evidence;
- marks negated facts.

- [x] **Step 3: Keep current dashboard compatibility**

Modify `parseTestInquiryLead()` to call `extractDeterministicFacts()` and expose `fence_length_m` only as legacy compatibility when a length measurement exists. Do not add industry-specific extractor branching.

- [x] **Step 4: Run tests**

Run: `npm run test`

Expected: all tests pass.

### Task 3: Verification

**Files:**

- Verify only.

- [x] **Step 1: Typecheck**

Run: `npm run typecheck`

Expected: pass.

- [x] **Step 2: Build**

Run: `npm run build`

Expected: pass.

- [x] **Step 3: Restart dev server if build invalidates dev cache**

Run: `npm run dev`

Expected: `http://localhost:3000/dashboard/leads/cmr5abwl20001itykg5rkkcdf` returns HTTP 200.
