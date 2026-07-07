import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyComputation } from "../lib/verifier/computation";
import type { ExtractedFact } from "../lib/extractor/types";

function fact(overrides: Partial<ExtractedFact> & { id: string }): ExtractedFact {
  return {
    id: overrides.id,
    kind: overrides.kind ?? "measurement",
    subject: overrides.subject ?? null,
    subjectSource: overrides.subjectSource ?? null,
    dimension: overrides.dimension ?? "length",
    value: overrides.value ?? null,
    valueMin: overrides.valueMin ?? null,
    valueMax: overrides.valueMax ?? null,
    unit: overrides.unit ?? "m",
    rawText: overrides.rawText ?? "",
    evidenceVerified: true,
    source: overrides.source ?? "deterministic",
    confidence: overrides.confidence ?? 1,
    negated: overrides.negated ?? false,
  };
}

const quantity2 = fact({
  id: "f_q",
  kind: "quantity",
  dimension: "count",
  value: 2,
  unit: "vnt",
});
const length2m = fact({ id: "f_m", value: 2, unit: "m" });

describe("verifyComputation", () => {
  it("accepts a multiply whose recomputed result matches and returns the measurement unit", () => {
    const result = verifyComputation({
      facts: [quantity2, length2m],
      computation: { op: "multiply", inputs: ["f_q", "f_m"] },
      expectedValue: 4,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: true, value: 4, unit: "m" });
  });

  it("accepts an add of same-unit inputs", () => {
    const result = verifyComputation({
      facts: [length2m, fact({ id: "f_m2", value: 3, unit: "m" })],
      computation: { op: "add", inputs: ["f_m", "f_m2"] },
      expectedValue: 5,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: true, value: 5, unit: "m" });
  });

  it("rejects when the arithmetic does not match", () => {
    const result = verifyComputation({
      facts: [quantity2, length2m],
      computation: { op: "multiply", inputs: ["f_q", "f_m"] },
      expectedValue: 5,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: false, reason: "RESULT_MISMATCH" });
  });

  it("rejects when an input id is missing", () => {
    const result = verifyComputation({
      facts: [quantity2],
      computation: { op: "multiply", inputs: ["f_q", "f_missing"] },
      expectedValue: 4,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: false, reason: "INPUT_NOT_FOUND" });
  });

  it("rejects when an input has no numeric value", () => {
    const result = verifyComputation({
      facts: [quantity2, fact({ id: "f_str", value: "trys" })],
      computation: { op: "multiply", inputs: ["f_q", "f_str"] },
      expectedValue: 4,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: false, reason: "INPUT_NOT_NUMERIC" });
  });

  it("rejects an add with conflicting units", () => {
    const result = verifyComputation({
      facts: [length2m, fact({ id: "f_cm", value: 3, unit: "cm" })],
      computation: { op: "add", inputs: ["f_m", "f_cm"] },
      expectedValue: 5,
      expectedUnit: "m",
    });

    assert.deepEqual(result, { ok: false, reason: "UNIT_CONFLICT" });
  });

  it("rejects when the expected unit disagrees with the computed unit", () => {
    const result = verifyComputation({
      facts: [quantity2, length2m],
      computation: { op: "multiply", inputs: ["f_q", "f_m"] },
      expectedValue: 4,
      expectedUnit: "m2",
    });

    assert.deepEqual(result, { ok: false, reason: "UNIT_CONFLICT" });
  });
});
