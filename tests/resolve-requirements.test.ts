import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtractedFact } from "../lib/extractor/types";
import { resolveRequirements } from "../lib/requirements/resolve-requirements";
import type { DecisionRequirement } from "../lib/rules/types";

const lengthRequirement: DecisionRequirement = {
  id: "req_fence_length",
  serviceId: "service_fences",
  requirementKey: "fence_length",
  label: "Tvoros ilgis",
  requiredFor: "auto_send",
  questionTextIfMissing: "Kiek metrų tvoros reikėtų?",
  blocksAutoSend: true,
  priority: 10,
  active: true,
  required: true,
  affectsPrice: true,
  expectedFact: {
    kind: "measurement",
    subject: "fence",
    dimension: "length",
    units: ["m"],
  },
  validation: { min: 1, max: 500 },
};

describe("resolveRequirements", () => {
  it("resolves a requirement only when exactly one fact has the expected subject", () => {
    const result = resolveRequirements({
      facts: [measurementFact({ id: "fact_1", subject: "fence", value: 45 })],
      requirements: [lengthRequirement],
    });

    assert.equal(result.resolvedRequirements.fence_length?.value, 45);
    assert.equal(result.resolvedRequirements.fence_length?.unit, "m");
    assert.equal(result.resolvedRequirements.fence_length?.factRef, "fact_1");
    assert.deepEqual(result.unresolvedRequirements, []);
    assert.deepEqual(result.conflicts, []);
  });

  it("keeps a subject-null fact pending for verified subject binding", () => {
    const result = resolveRequirements({
      facts: [measurementFact({ id: "fact_1", subject: null, value: 45 })],
      requirements: [lengthRequirement],
    });

    assert.equal(result.resolvedRequirements.fence_length, null);
    assert.deepEqual(result.unresolvedRequirements, [
      {
        requirementKey: "fence_length",
        label: "Tvoros ilgis",
        question: "Kiek metrų tvoros reikėtų?",
        required: true,
        affectsPrice: true,
        status: "pending_binding",
        candidateFactRefs: ["fact_1"],
      },
    ]);
    assert.deepEqual(result.conflicts, []);
  });

  it("marks multiple matching facts for one requirement as a conflict", () => {
    const result = resolveRequirements({
      facts: [
        measurementFact({ id: "fact_1", subject: "fence", value: 45 }),
        measurementFact({ id: "fact_2", subject: "fence", value: 50 }),
      ],
      requirements: [lengthRequirement],
    });

    assert.equal(result.resolvedRequirements.fence_length, null);
    assert.deepEqual(result.unresolvedRequirements, [
      {
        requirementKey: "fence_length",
        label: "Tvoros ilgis",
        question: "Kiek metrų tvoros reikėtų?",
        required: true,
        affectsPrice: true,
        status: "conflict",
        candidateFactRefs: ["fact_1", "fact_2"],
      },
    ]);
    assert.deepEqual(result.conflicts, [
      {
        requirementKey: "fence_length",
        factRefs: ["fact_1", "fact_2"],
        reason: "MULTIPLE_FACTS_FOR_REQUIREMENT",
      },
    ]);
  });

  it("rejects a resolved fact when validation bounds fail", () => {
    const result = resolveRequirements({
      facts: [measurementFact({ id: "fact_1", subject: "fence", value: 900 })],
      requirements: [lengthRequirement],
    });

    assert.equal(result.resolvedRequirements.fence_length, null);
    assert.deepEqual(result.unresolvedRequirements, [
      {
        requirementKey: "fence_length",
        label: "Tvoros ilgis",
        question:
          "Nurodytas 900 m ilgis viršija įprastą 1–500 m ribą. Ar galite patikslinti planuojamą ilgį?",
        required: true,
        affectsPrice: true,
        status: "conflict",
        candidateFactRefs: ["fact_1"],
      },
    ]);
    assert.deepEqual(result.conflicts, [
      {
        requirementKey: "fence_length",
        factRefs: ["fact_1"],
        reason: "VALUE_OUT_OF_RANGE",
        clarificationQuestion:
          "Nurodytas 900 m ilgis viršija įprastą 1–500 m ribą. Ar galite patikslinti planuojamą ilgį?",
      },
    ]);
  });
});

function measurementFact(overrides: Partial<ExtractedFact>): ExtractedFact {
  return {
    id: "fact_1",
    kind: "measurement",
    subject: "fence",
    subjectSource: "ai",
    dimension: "length",
    value: 45,
    valueMin: null,
    valueMax: null,
    unit: "m",
    rawText: "tvoros 45 m",
    evidenceVerified: true,
    source: "deterministic",
    confidence: 0.98,
    negated: false,
    ...overrides,
  };
}
