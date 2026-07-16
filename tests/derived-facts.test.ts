import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDeterministicLeadPipelineForTests } from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type { ClientRules } from "../lib/rules/types";

// Pipeline-lygio testai: deterministika ištraukia atomus, AI grąžina derived
// fact su computation, computation verifier perskaičiuoja. Sistemos elgsena
// išlieka ta pati kaip su senais per-item regex'ais („... po 2m" → bendras 4m).

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
        pricePerUnit: 85,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
      },
    },
  ],
  decisionRequirements: [
    requirement("fence_length", "length", { min: 1, max: 500 }),
    requirement("fence_height", "height", { min: 0.8, max: 2.5 }),
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
        blockIfConflicts: true,
        blockIfRange: false,
        confidenceBands: { autoSend: 0.85, draftForReview: 0.6 },
      },
    },
  ],
  responseTemplates: [
    {
      templateKey: "price_estimate",
      body: "Kaina: {{priceAmount}} {{currency}}.",
      active: true,
    },
    {
      templateKey: "ask_missing_info",
      body: "Patikslinkite: {{questions}}",
      active: true,
    },
  ],
};

type AiFact = {
  id: string;
  kind: string;
  dimension: string | null;
  value: number | string | boolean | null;
  subject: string | null;
  rawText: string;
};

// AI mock'as, kuris „supranta" tekstą: randa kiekio ir per-unit ilgio atomus,
// grąžina derived fact su computation. Kodas (verifier) perskaičiuoja.
function computationMock(opts?: {
  valueOverride?: number;
  confidence?: number;
}) {
  const confidence = opts?.confidence ?? 0.9;
  return async (request: { user: string }): Promise<string> => {
    const payload = JSON.parse(request.user) as {
      rawText: string;
      existingFacts: AiFact[];
    };
    const facts = payload.existingFacts;
    const quantity = facts.find((fact) => fact.kind === "quantity");
    const perUnit = facts.find(
      (fact) =>
        fact.kind === "measurement" &&
        fact.dimension === "length" &&
        fact.subject === null,
    );
    const height = facts.find(
      (fact) => fact.kind === "measurement" && fact.dimension === "height",
    );

    if (!quantity || !perUnit) {
      throw new Error("test mock expected quantity and per-unit atoms");
    }

    const total =
      opts?.valueOverride ?? Number(quantity.value) * Number(perUnit.value);

    return JSON.stringify({
      bindings: height
        ? [
            {
              factId: height.id,
              subject: "fence",
              evidence: height.rawText,
              confidence: 0.9,
            },
          ]
        : [],
      newFacts: [
        {
          requirementKey: "fence_length",
          kind: "measurement",
          dimension: "length",
          value: total,
          valueMin: null,
          valueMax: null,
          unit: "m",
          // Realus AI cituotų per-item fragmentą; testui naudojam visą žinutę,
          // kad evidence tikrai egzistuotų — computation verifier tikrina skaičių.
          evidence: payload.rawText,
          confidence,
          computation: { op: "multiply", inputs: [quantity.id, perUnit.id] },
        },
      ],
      conflicts: [],
      serviceClassification: null,
      primaryIntent: "requests_quote",
    });
  };
}

describe("derived facts pipeline", () => {
  const cases: Array<{ label: string; text: string; total: number }> = [
    {
      label: "segment count before per-item length",
      text: "Hey, reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos?",
      total: 4,
    },
    {
      label: "compact multiplier",
      text: "Reikia 2x2m segmentų, aukštis 1.5m. Kiek kainuos?",
      total: 4,
    },
    {
      label: "per-item length before count",
      text: "Reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio. Kiek kainuos?",
      total: 4,
    },
    {
      label: "free-form word numbers",
      text: "du segmentai po du metrus, 1.5m aukščio, kiek kainuos?",
      total: 4,
    },
    {
      label: "free-form count after length",
      text: "segmentai 2m, reikes 2vnt, aukštis 1.5m, kiek kainuos?",
      total: 4,
    },
  ];

  for (const testCase of cases) {
    it(`derives total length for: ${testCase.label}`, async () => {
      const result = await runDeterministicLeadPipelineForTests({
        input: { ...baseInput(), inquiryMessage: testCase.text },
        rules,
        leadId: `derived_${testCase.label}`,
        isTest: true,
        aiOptions: {
          env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
          callModel: computationMock(),
        },
      });

      const aiStage = result.trace.stages.find(
        (stage) => stage.key === "ai_gap_filler",
      );

      assert.equal(result.responseStatus, "ready", testCase.label);
      assert.equal(
        result.decisionResult.priceEstimate?.quantity,
        testCase.total,
        testCase.label,
      );
      assert.equal(
        result.parsedLead.resolvedRequirements.fence_length?.value,
        testCase.total,
        testCase.label,
      );
      assert.equal(
        result.parsedLead.resolvedRequirements.fence_length?.source,
        "ai",
        testCase.label,
      );
      assert.deepEqual(aiStage?.data.rejectedFindings, [], testCase.label);
    });
  }

  it("rejects a derived fact whose computation does not match and leaves the requirement unresolved", async () => {
    const result = await runDeterministicLeadPipelineForTests({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Hey, reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos?",
      },
      rules,
      leadId: "derived_mismatch",
      isTest: true,
      aiOptions: {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        callModel: computationMock({ valueOverride: 999 }),
      },
    });

    const aiStage = result.trace.stages.find(
      (stage) => stage.key === "ai_gap_filler",
    );

    assert.deepEqual(aiStage?.data.rejectedFindings, [
      {
        type: "newFact",
        target: "fence_length",
        reason: "COMPUTATION_MISMATCH",
      },
    ]);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(
      result.parsedLead.resolvedRequirements.fence_length ?? null,
      null,
    );
  });

  it("routes a price-affecting derived AI fact through the AI-source autosend gate", async () => {
    const result = await runDeterministicLeadPipelineForTests({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Hey, reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos?",
      },
      rules,
      leadId: "derived_autosend_gate",
      isTest: false,
      aiOptions: {
        env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
        // Žemas confidence (< 0.85 juostos) → derived AI fact eina per AI-fact
        // autosend vartus ir yra blokuojamas dėl per žemo pasitikėjimo.
        callModel: computationMock({ confidence: 0.7 }),
      },
    });

    assert.equal(result.decisionResult.priceEstimate?.quantity, 4);
    assert.equal(result.autoSendAllowed, false);
    assert.ok(
      result.composed?.autoSendBlockedBy.some((reason) =>
        reason.startsWith("PRICE_REQUIREMENT_CONFIDENCE_BLOCKED:fence_length"),
      ),
      `blockers: ${result.composed?.autoSendBlockedBy.join(", ")}`,
    );
  });
});

function requirement(
  requirementKey: string,
  dimension: "length" | "height",
  validation: { min: number; max: number },
) {
  return {
    id: `req_${requirementKey}`,
    serviceId: "service_skardines_tvoros",
    requirementKey,
    label: requirementKey,
    requiredFor: "auto_send",
    questionTextIfMissing: `Nurodykite ${requirementKey}?`,
    blocksAutoSend: true,
    priority: dimension === "length" ? 10 : 20,
    active: true,
    required: true,
    affectsPrice: true,
    expectedFact: {
      kind: "measurement",
      subject: "fence",
      dimension,
      units: ["m"],
    },
    validation,
  };
}

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
