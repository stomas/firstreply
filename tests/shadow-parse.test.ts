import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeShadowDiff } from "../lib/ai/shadow-parse";
import { runTestLeadPipeline } from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type {
  ClientRules,
  DecisionRequirement,
  ResolvedRequirementValue,
} from "../lib/rules/types";

const shadowEnv = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "test-model",
  SHADOW_AI_PARSE: "true",
};

function requirement(key: string): DecisionRequirement {
  return {
    id: `req_${key}`,
    serviceId: "service_skardines_tvoros",
    requirementKey: key,
    label: key,
    requiredFor: "auto_send",
    questionTextIfMissing: `Nurodykite ${key}?`,
    blocksAutoSend: true,
    priority: 10,
    active: true,
    required: true,
    affectsPrice: true,
    expectedFact: { kind: "measurement", subject: "fence", units: ["m"] },
    validation: { min: 0.1, max: 500 },
  };
}

function resolved(value: number): ResolvedRequirementValue {
  return {
    value,
    valueMin: null,
    valueMax: null,
    unit: "m",
    factRef: "fact_1",
    source: "deterministic",
    subjectSource: "deterministic",
    confidence: 1,
    validationPassed: true,
    evidenceVerified: true,
  };
}

describe("computeShadowDiff", () => {
  const requirements = [
    requirement("fence_length"),
    requirement("fence_height"),
  ];

  it("classifies match / value_diff / ai_missing / ai_only", () => {
    const diff = computeShadowDiff(
      { fence_length: resolved(45), fence_height: resolved(1.7) },
      [
        {
          requirementKey: "fence_length",
          kind: "measurement",
          value: 45,
          evidence: "45 m",
          confidence: 0.9,
        },
        {
          requirementKey: "gate_width",
          kind: "measurement",
          value: 3,
          evidence: "3 m",
          confidence: 0.9,
        },
      ],
      requirements,
    );

    assert.equal(diff.fence_length.status, "match");
    assert.equal(diff.fence_height.status, "ai_missing");
    assert.equal(diff.gate_width.status, "ai_only");
  });

  it("flags a value difference within requirement scope", () => {
    const diff = computeShadowDiff(
      { fence_height: resolved(1.7) },
      [
        {
          requirementKey: "fence_height",
          kind: "measurement",
          value: 1.5,
          evidence: "1.5 m",
          confidence: 0.9,
        },
      ],
      [requirement("fence_height")],
    );

    assert.equal(diff.fence_height.status, "value_diff");
    assert.equal(diff.fence_height.mainValue, 1.7);
    assert.equal(diff.fence_height.shadowValue, 1.5);
  });

  it("handles range values (valueMin/valueMax) on the shadow side", () => {
    const diff = computeShadowDiff(
      { fence_height: resolved(1.7) },
      [
        {
          requirementKey: "fence_height",
          kind: "measurement",
          value: null,
          valueMin: 1.5,
          valueMax: 1.7,
          evidence: "apie 1.5-1.7",
          confidence: 0.9,
        },
      ],
      [requirement("fence_height")],
    );

    assert.equal(diff.fence_height.status, "value_diff");
    assert.deepEqual(diff.fence_height.shadowValue, { min: 1.5, max: 1.7 });
  });
});

describe("shadow parse pipeline integration", () => {
  it("does not run shadow (no AI call, no stage) when the flag is off", async () => {
    let calls = 0;
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "shadow_off",
      isTest: true,
      aiOptions: {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: async () => {
          calls += 1;
          return "{}";
        },
      },
    });

    assert.equal(calls, 0);
    assert.equal(
      result.trace.stages.some((stage) => stage.key === "shadow_parse"),
      false,
    );
    assert.equal(result.shadowDiff, undefined);
  });

  it("runs shadow and computes a diff when the flag is on", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "shadow_on",
      isTest: true,
      aiOptions: {
        env: shadowEnv,
        callModel: async () =>
          JSON.stringify({
            facts: [
              {
                requirementKey: "fence_length",
                kind: "measurement",
                subject: "fence",
                dimension: "length",
                value: 45,
                unit: "m",
                evidence: "45 metrai",
                confidence: 0.9,
              },
              {
                requirementKey: "fence_height",
                kind: "measurement",
                subject: "fence",
                dimension: "height",
                value: 1.5,
                unit: "m",
                evidence: "1.7 m aukščio",
                confidence: 0.9,
              },
            ],
          }),
      },
    });

    const shadowStage = result.trace.stages.find(
      (stage) => stage.key === "shadow_parse",
    );

    // Pagrindinis sprendimas nepaveiktas shadow'o.
    assert.equal(result.responseStatus, "ready");
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(shadowStage?.status, "ok");
    assert.equal(result.shadowDiff?.fence_length.status, "match");
    assert.equal(result.shadowDiff?.fence_height.status, "value_diff");
  });

  it("normalizes a range value returned as an object instead of failing to parse", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "shadow_range",
      isTest: true,
      aiOptions: {
        env: shadowEnv,
        callModel: async () =>
          JSON.stringify({
            facts: [
              {
                requirementKey: "fence_length",
                kind: "measurement",
                subject: "fence",
                dimension: "length",
                value: 45,
                unit: "m",
                evidence: "45 metrai",
                confidence: 0.99,
              },
              {
                requirementKey: "fence_height",
                kind: "measurement",
                subject: "fence",
                dimension: "height",
                value: { min: 1.5, max: 1.7 },
                unit: "m",
                evidence: "1.7 m aukščio",
                confidence: 0.93,
              },
            ],
          }),
      },
    });

    const shadowStage = result.trace.stages.find(
      (stage) => stage.key === "shadow_parse",
    );

    assert.equal(shadowStage?.status, "ok");
    assert.equal(result.shadowDiff?.fence_length.status, "match");
    assert.equal(result.shadowDiff?.fence_height.status, "value_diff");
    assert.deepEqual(result.shadowDiff?.fence_height.shadowValue, {
      min: 1.5,
      max: 1.7,
    });
  });

  it("never breaks the main pipeline when the shadow AI call throws", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "shadow_error",
      isTest: true,
      aiOptions: {
        env: shadowEnv,
        callModel: async () => {
          throw new Error("shadow AI 500");
        },
      },
    });

    const shadowStage = result.trace.stages.find(
      (stage) => stage.key === "shadow_parse",
    );

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.priceEstimate?.amount, 4950);
    assert.equal(shadowStage?.status, "rejected");
    assert.equal(result.shadowDiff, undefined);
  });
});

function baseInput(): TestInquiryInput {
  return {
    serviceId: "service_skardines_tvoros",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    city: "Vilnius",
    inquiryMessage: "",
    asksPrice: true,
    asksAvailability: false,
    isUrgent: false,
  };
}

const rules: ClientRules = {
  services: [
    { id: "service_skardines_tvoros", name: "Skardinės tvoros", active: true },
  ],
  serviceSubjects: [
    {
      serviceId: "service_skardines_tvoros",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "skardinė tvora",
      synonyms: ["tvora", "tvoros", "skardinė"],
    },
  ],
  pricingRules: [
    {
      id: "price_skardine_per_m",
      serviceId: "service_skardines_tvoros",
      name: "Skardinė tvora pagal metrą",
      priceMin: 85,
      priceMax: 240,
      unit: "€/m",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        pricePerUnit: 110,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
      },
    },
  ],
  decisionRequirements: [
    {
      ...requirement("fence_length"),
      expectedFact: {
        kind: "measurement",
        subject: "fence",
        dimension: "length",
        units: ["m"],
      },
      validation: { min: 1, max: 500 },
    },
    {
      ...requirement("fence_height"),
      priority: 20,
      expectedFact: {
        kind: "measurement",
        subject: "fence",
        dimension: "height",
        units: ["m"],
      },
      validation: { min: 0.8, max: 2.5 },
    },
  ],
  availabilityRules: [],
  locationZones: [
    {
      adminUnitCode: "vilniaus_m_sav",
      zone: "zone_a",
      travelFeeEur: 0,
      served: true,
    },
  ],
  scheduleRules: [{ rule: { type: "lead_time_weeks", min: 3, max: 5 } }],
  autosendPolicies: [
    {
      policy: {
        enabled: true,
        requireAllRequiredResolved: true,
        priceAffectingRequirements: {
          allowSources: ["deterministic", "form_field"],
          aiAllowedIf: {
            evidenceVerified: true,
            minConfidence: 0.85,
            validationPassed: true,
          },
        },
        confidenceBands: { autoSend: 0.85, draftForReview: 0.6 },
      },
    },
  ],
  responseTemplates: [
    {
      templateKey: "price_estimate",
      body: "Kaina: {{priceAmount}} {{currency}}. Terminas: {{leadTimeWeeks}}.",
      active: true,
    },
  ],
};
