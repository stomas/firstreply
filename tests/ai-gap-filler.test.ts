import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppConfigError } from "../lib/app-errors";
import {
  assertAiGapFillerConfigured,
  fillAiGaps,
  needsAiGapFiller,
} from "../lib/ai/gap-filler";
import type { ExtractedFact } from "../lib/extractor/types";
import type {
  DecisionRequirement,
  RequirementResolutionResult,
  ServiceSubjectRule,
} from "../lib/rules/types";

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

const heightRequirement: DecisionRequirement = {
  ...lengthRequirement,
  id: "req_fence_height",
  requirementKey: "fence_height",
  label: "Tvoros aukštis",
  questionTextIfMissing: "Koks tvoros aukštis?",
  expectedFact: {
    kind: "measurement",
    subject: "fence",
    dimension: "height",
    units: ["m"],
  },
  validation: { min: 0.8, max: 3 },
};

const subjects: ServiceSubjectRule[] = [
  {
    serviceId: "service_fences",
    subjectKey: "fence",
    labelLt: "Tvora",
    descriptionLt: "tvora, sklypo aptvėrimas",
    synonyms: ["tvora", "tvoros"],
  },
];

describe("AI gap filler configuration gate", () => {
  it("requires AI when resolver has pending subject bindings", () => {
    assert.equal(
      needsAiGapFiller({
        resolvedRequirements: { fence_length: null },
        unresolvedRequirements: [
          {
            requirementKey: "fence_length",
            label: "Tvoros ilgis",
            question: "Kiek metrų tvoros reikėtų?",
            required: true,
            affectsPrice: true,
            status: "pending_binding",
            candidateFactRefs: ["fact_1"],
          },
        ],
        conflicts: [],
      }),
      true,
    );
  });

  it("requires AI when a required requirement is unresolved", () => {
    assert.equal(
      needsAiGapFiller({
        resolvedRequirements: { fence_length: null },
        unresolvedRequirements: [
          {
            requirementKey: "fence_length",
            label: "Tvoros ilgis",
            question: "Kiek metrų tvoros reikėtų?",
            required: true,
            affectsPrice: true,
            status: "unresolved",
            candidateFactRefs: [],
          },
        ],
        conflicts: [],
      }),
      true,
    );
  });

  it("stops with AI_NOT_CONFIGURED when AI is required but config is missing", () => {
    const result: RequirementResolutionResult = {
      resolvedRequirements: { fence_length: null },
      unresolvedRequirements: [
        {
          requirementKey: "fence_length",
          label: "Tvoros ilgis",
          question: "Kiek metrų tvoros reikėtų?",
          required: true,
          affectsPrice: true,
          status: "pending_binding",
          candidateFactRefs: ["fact_1"],
        },
      ],
      conflicts: [],
    };

    assert.throws(
      () =>
        assertAiGapFillerConfigured(result, {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        }),
      (error) =>
        error instanceof AppConfigError &&
        error.message.includes("AI_NOT_CONFIGURED"),
    );
  });

  it("binds a subject-null deterministic fact when AI evidence verifies", async () => {
    const result = await fillAiGaps(
      {
        rawText: "Sveiki, reikia tvoros 45 metrai.",
        facts: [measurementFact({ id: "fact_1", subject: null, value: 45 })],
        requirements: [lengthRequirement],
        resolution: {
          resolvedRequirements: { fence_length: null },
          unresolvedRequirements: [
            {
              requirementKey: "fence_length",
              label: "Tvoros ilgis",
              question: "Kiek metrų tvoros reikėtų?",
              required: true,
              affectsPrice: true,
              status: "pending_binding",
              candidateFactRefs: ["fact_1"],
            },
          ],
          conflicts: [],
        },
        subjects,
      },
      {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: async () =>
          JSON.stringify({
            bindings: [
              {
                factId: "fact_1",
                subject: "fence",
                evidence: "tvoros 45 metrai",
                confidence: 0.91,
              },
            ],
            newFacts: [],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    );

    assert.equal(result.status, "ok");
    if (result.status !== "ok") {
      return;
    }

    assert.equal(result.facts[0].subject, "fence");
    assert.equal(result.facts[0].subjectSource, "ai");
    assert.equal(
      result.resolution.resolvedRequirements.fence_length?.value,
      45,
    );
    assert.deepEqual(result.rejectedFindings, []);
  });

  it("rejects AI bindings when evidence cannot be verified", async () => {
    const result = await fillAiGaps(
      {
        rawText: "Sveiki, reikia tvoros 45 metrai.",
        facts: [measurementFact({ id: "fact_1", subject: null, value: 45 })],
        requirements: [lengthRequirement],
        resolution: {
          resolvedRequirements: { fence_length: null },
          unresolvedRequirements: [
            {
              requirementKey: "fence_length",
              label: "Tvoros ilgis",
              question: "Kiek metrų tvoros reikėtų?",
              required: true,
              affectsPrice: true,
              status: "pending_binding",
              candidateFactRefs: ["fact_1"],
            },
          ],
          conflicts: [],
        },
        subjects,
      },
      {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: async () =>
          JSON.stringify({
            bindings: [
              {
                factId: "fact_1",
                subject: "fence",
                evidence: "vartai 6 m",
                confidence: 0.91,
              },
            ],
            newFacts: [],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    );

    assert.equal(result.status, "ok");
    if (result.status !== "ok") {
      return;
    }

    assert.equal(result.facts[0].subject, null);
    assert.equal(result.resolution.resolvedRequirements.fence_length, null);
    assert.deepEqual(result.rejectedFindings, [
      {
        type: "binding",
        target: "fact_1",
        reason: "EVIDENCE_NOT_FOUND",
      },
    ]);
  });

  it("adds verified AI new facts and resolves them on the second resolver pass", async () => {
    const result = await fillAiGaps(
      {
        rawText: "Sveiki, reikia tvoros 45 metrai, 1,7 m aukščio.",
        facts: [measurementFact({ id: "fact_1", subject: "fence", value: 45 })],
        requirements: [lengthRequirement, heightRequirement],
        resolution: {
          resolvedRequirements: {
            fence_length: {
              value: 45,
              valueMin: null,
              valueMax: null,
              unit: "m",
              factRef: "fact_1",
              source: "deterministic",
              subjectSource: "ai",
              confidence: 0.98,
              validationPassed: true,
            },
            fence_height: null,
          },
          unresolvedRequirements: [
            {
              requirementKey: "fence_height",
              label: "Tvoros aukštis",
              question: "Koks tvoros aukštis?",
              required: true,
              affectsPrice: true,
              status: "unresolved",
              candidateFactRefs: [],
            },
          ],
          conflicts: [],
        },
        subjects,
      },
      {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: async () =>
          JSON.stringify({
            bindings: [],
            newFacts: [
              {
                requirementKey: "fence_height",
                kind: "measurement",
                dimension: "height",
                value: 1.7,
                valueMin: null,
                valueMax: null,
                unit: "m",
                evidence: "1,7 m aukščio",
                confidence: 0.9,
              },
            ],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    );

    assert.equal(result.status, "ok");
    if (result.status !== "ok") {
      return;
    }

    assert.equal(result.facts.at(-1)?.source, "ai");
    assert.equal(
      result.resolution.resolvedRequirements.fence_height?.value,
      1.7,
    );
  });

  it("retries invalid JSON once and returns manual review when parsing still fails", async () => {
    const calls: string[] = [];
    const result = await fillAiGaps(
      {
        rawText: "Sveiki, reikia tvoros 45 metrai.",
        facts: [measurementFact({ id: "fact_1", subject: null, value: 45 })],
        requirements: [lengthRequirement],
        resolution: {
          resolvedRequirements: { fence_length: null },
          unresolvedRequirements: [
            {
              requirementKey: "fence_length",
              label: "Tvoros ilgis",
              question: "Kiek metrų tvoros reikėtų?",
              required: true,
              affectsPrice: true,
              status: "pending_binding",
              candidateFactRefs: ["fact_1"],
            },
          ],
          conflicts: [],
        },
        subjects,
      },
      {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: async (request) => {
          calls.push(request.user);
          return "not json";
        },
      },
    );

    assert.equal(calls.length, 2);
    assert.deepEqual(result, {
      status: "manual_review",
      reason: "AI_PARSE_FAILED",
      rawResponses: ["not json", "not json"],
    });
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
    rawText: "tvoros 45 metrai",
    evidenceVerified: true,
    source: "deterministic",
    confidence: 0.98,
    negated: false,
    ...overrides,
  };
}
