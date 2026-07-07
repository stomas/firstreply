import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppConfigError } from "../lib/app-errors";
import { AI_NOT_CONFIGURED } from "../lib/ai/gap-filler";
import { runTestLeadPipeline } from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type { ClientRules } from "../lib/rules/types";

const rules: ClientRules = {
  services: [
    {
      id: "service_skardines_tvoros",
      name: "Skardinės tvoros",
      active: true,
    },
  ],
  serviceSubjects: [
    {
      serviceId: "service_skardines_tvoros",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "skardinė tvora, sklypo aptvėrimas",
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
        modifiers: [
          {
            if: { requirementKey: "fence_height", gte: 1.7 },
            pricePerUnitDelta: 25,
          },
        ],
      },
    },
  ],
  decisionRequirements: [
    {
      id: "req_fence_length",
      serviceId: "service_skardines_tvoros",
      requirementKey: "fence_length",
      label: "Tvoros ilgis",
      requiredFor: "auto_send",
      questionTextIfMissing: "Kiek metrų skardinės tvoros reikėtų?",
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
    },
    {
      id: "req_fence_height",
      serviceId: "service_skardines_tvoros",
      requirementKey: "fence_height",
      label: "Tvoros aukštis",
      requiredFor: "auto_send",
      questionTextIfMissing: "Kokio aukščio skardinės tvoros norėtumėte?",
      blocksAutoSend: true,
      priority: 20,
      active: true,
      required: true,
      affectsPrice: true,
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
  scheduleRules: [
    {
      rule: { type: "lead_time_weeks", min: 3, max: 5 },
    },
  ],
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
        confidenceBands: {
          autoSend: 0.85,
          draftForReview: 0.6,
        },
      },
    },
  ],
  responseTemplates: [
    {
      templateKey: "ask_missing_info",
      body: "Sveiki, patikslinkite: {{questions}}",
      active: true,
    },
    {
      templateKey: "price_estimate",
      body: "Sveiki, orientacinė kaina: {{priceAmount}} {{currency}}. Terminas: {{leadTimeWeeks}}.",
      active: true,
    },
    {
      templateKey: "decline_location",
      body: "Atsiprašome, šioje vietovėje nedirbame.",
      active: true,
    },
    {
      templateKey: "offering_answer",
      body: "Sveiki, ačiū už užklausą. {{offeringDescription}} {{offeringFollowup}}",
      active: true,
    },
  ],
};

describe("golden lead pipeline", () => {
  it("produces a price draft and trace for a clear skardine fence inquiry without AI", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "golden_lead",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        },
      },
    });

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.evaluation.responseType, "price_availability");
    assert.equal(result.evaluation.autoSendAllowed, false);
    assert.deepEqual(result.evaluation.manualReviewReasons, ["TEST_LEAD"]);
    assert.deepEqual(result.evaluation.missingRequirements, []);
    assert.equal(
      result.evaluation.draftText,
      "Sveiki, orientacinė kaina: 4950 EUR. Terminas: 3-5 sav..",
    );
    assert.deepEqual(
      result.trace.stages.map((stage) => [stage.key, stage.status]),
      [
        ["parse", "ok"],
        ["service_classification", "ok"],
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "skipped"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("auto-detects the service when the test input has no selected service", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje. Kiek kainuotų?",
      },
      rules: rulesWithGateService(),
      leadId: "golden_auto_service",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        },
      },
    });

    assert.equal(result.parsedLead.serviceId, "service_skardines_tvoros");
    assert.equal(result.responseStatus, "ready");
    assert.equal(result.evaluation.responseType, "price_availability");
    assert.equal(result.decisionResult.priceEstimate?.amount, 4950);
    assert.deepEqual(
      result.trace.stages.map((stage) => [stage.key, stage.status]),
      [
        ["parse", "ok"],
        ["service_classification", "ok"],
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "skipped"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("answers an offering question from DB fields without asking for width or calling AI", async () => {
    const offeringRules: ClientRules = {
      ...rulesWithGateService(),
      decisionRequirements: [
        ...rules.decisionRequirements,
        {
          id: "req_gate_width",
          serviceId: "service_vartai",
          requirementKey: "gate_width",
          label: "Vartų plotis",
          requiredFor: "auto_send",
          questionTextIfMissing: "Koks planuojamos vartų angos plotis metrais?",
          blocksAutoSend: true,
          priority: 10,
          active: true,
          required: true,
          affectsPrice: true,
          expectedFact: {
            kind: "measurement",
            subject: "gate",
            dimension: "width",
            units: ["m"],
          },
          validation: { min: 2, max: 8 },
        },
      ],
    };

    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        asksPrice: false,
        inquiryMessage: "labas, o turit pas save metaliniu vartu?",
      },
      rules: offeringRules,
      leadId: "golden_offering",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        },
      },
    });

    assert.equal(result.parsedLead.serviceId, "service_vartai");
    assert.equal(result.parsedLead.primaryIntent, "asks_offering");
    assert.equal(result.decisionResult.decision, "OFFERING_ANSWER");
    assert.equal(result.responseType, "offering_answer");
    assert.equal(result.responseStatus, "ready");
    assert.deepEqual(result.decisionResult.questionsToAsk, []);
    assert.equal(
      result.draftText,
      "Sveiki, ačiū už užklausą. Taip, gaminame ir montuojame metalinius kiemo vartus — varstomus ir stumdomus. Jei norite, galiu paskaičiuoti orientacinę kainą — kokio pločio įvažiavimo angą turite?",
    );
    assert.equal(result.draftText?.includes("angos plotis"), false);
    assert.ok(result.draftText?.includes("kokio pločio įvažiavimo angą"));
    assert.deepEqual(
      result.trace.stages.map((stage) => [stage.key, stage.status]),
      [
        ["parse", "ok"],
        ["service_classification", "ok"],
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "skipped"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("stops with a clear config error when unresolved requirements need AI", async () => {
    try {
      await runTestLeadPipeline({
        input: {
          ...baseInput(),
          inquiryMessage: "Sveiki, reikia tvoros Vilniuje. Kiek kainuotų?",
        },
        rules,
        leadId: "golden_missing",
        isTest: true,
        aiOptions: {
          env: {
            OPENAI_API_KEY: "",
            OPENAI_MODEL: "",
          },
        },
      });
      assert.fail("Expected AI_NOT_CONFIGURED");
    } catch (error) {
      assert.ok(error instanceof AppConfigError);
      assert.ok(error.message.includes(AI_NOT_CONFIGURED));
      assert.deepEqual(
        (
          error as AppConfigError & {
            trace?: { stages: Array<{ key: string; status: string }> };
          }
        ).trace?.stages.map((stage) => [stage.key, stage.status]),
        [
          ["parse", "ok"],
          ["service_classification", "ok"],
          ["resolver_pass_1", "ok"],
          ["ai_gap_filler", "manual_review"],
        ],
      );
    }
  });

  it("declines a clear inquiry outside served municipalities", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        city: "Klaipėda",
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Klaipėdoje. Kiek kainuotų?",
      },
      rules,
      leadId: "golden_decline",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        },
      },
    });

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.responseType, "decline");
    assert.equal(result.decisionResult.reason, "LOCATION_NOT_SERVED");
    assert.equal(result.draftText, "Atsiprašome, šioje vietovėje nedirbame.");
    assert.deepEqual(
      result.trace.stages.map((stage) => [stage.key, stage.status]),
      [
        ["parse", "ok"],
        ["service_classification", "ok"],
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "skipped"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("asks missing questions after AI finds no additional facts", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Sveiki, reikia skardinės tvoros Vilniuje. Kiek kainuotų?",
      },
      rules,
      leadId: "golden_missing_questions",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_MODEL: "test-model",
        },
        callModel: async () =>
          JSON.stringify({
            bindings: [],
            newFacts: [],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    });

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.responseType, "missing_info");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kiek metrų skardinės tvoros reikėtų?",
      "Kokio aukščio skardinės tvoros norėtumėte?",
    ]);
    assert.equal(
      result.draftText,
      "Sveiki, patikslinkite: Kiek metrų skardinės tvoros reikėtų? Kokio aukščio skardinės tvoros norėtumėte?",
    );
    assert.deepEqual(
      result.trace.stages.map((stage) => [stage.key, stage.status]),
      [
        ["parse", "ok"],
        ["service_classification", "ok"],
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "ok"],
        ["resolver_pass_2", "ok"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("uses AI to derive total length from per-segment wording instead of pricing one segment", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Hey, ždž reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos ir ar duodat pristatymą?",
      },
      rules,
      leadId: "golden_per_segment",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_MODEL: "test-model",
        },
        callModel: async () =>
          JSON.stringify({
            bindings: [
              {
                factId: "fact_1",
                subject: "fence",
                evidence: "2 segmentu po 2m",
                confidence: 0.91,
              },
              {
                factId: "fact_2",
                subject: "fence",
                evidence: "1.5m aukščio",
                confidence: 0.91,
              },
            ],
            newFacts: [],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    });
    const aiStage = result.trace.stages.find(
      (stage) => stage.key === "ai_gap_filler",
    );

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.decisionResult.priceEstimate?.quantity, 4);
    assert.equal(result.decisionResult.priceEstimate?.amount, 340);
    assert.equal(
      result.draftText,
      "Sveiki, orientacinė kaina: 340 EUR. Terminas: 3-5 sav..",
    );
    assert.deepEqual(aiStage?.data.rejectedFindings, []);
  });

  it("derives total length when the per-segment length appears before the count", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        inquiryMessage:
          "Hey, ždž reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio. Kiek kainuos ir ar duodat pristatymą?",
      },
      rules,
      leadId: "golden_reversed_per_segment",
      isTest: true,
      aiOptions: {
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_MODEL: "test-model",
        },
        callModel: async () =>
          JSON.stringify({
            bindings: [
              {
                factId: "fact_1",
                subject: "fence",
                evidence: "2m segmento kokius 2 vienetus",
                confidence: 0.91,
              },
              {
                factId: "fact_2",
                subject: "fence",
                evidence: "1.5m aukščio",
                confidence: 0.91,
              },
            ],
            newFacts: [],
            conflicts: [],
            serviceClassification: null,
          }),
      },
    });

    assert.equal(result.responseStatus, "ready");
    assert.equal(result.decisionResult.priceEstimate?.quantity, 4);
    assert.equal(result.decisionResult.priceEstimate?.amount, 340);
    assert.equal(
      result.draftText,
      "Sveiki, orientacinė kaina: 340 EUR. Terminas: 3-5 sav..",
    );
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

function rulesWithGateService(): ClientRules {
  return {
    ...rules,
    services: [
      {
        ...rules.services[0],
        label: "Skardinės tvoros",
        keywords: ["skardinė", "skardinės", "skarda", "tvora", "tvoros"],
      },
      {
        id: "service_vartai",
        name: "Vartai ir varteliai",
        label: "Vartai ir varteliai",
        keywords: ["vartai", "vartų", "vartus", "varteliai"],
        offeringDescription:
          "Taip, gaminame ir montuojame metalinius kiemo vartus — varstomus ir stumdomus.",
        offeringFollowup:
          "Jei norite, galiu paskaičiuoti orientacinę kainą — kokio pločio įvažiavimo angą turite?",
        active: true,
      },
    ],
    serviceSubjects: [
      ...(rules.serviceSubjects ?? []),
      {
        serviceId: "service_vartai",
        subjectKey: "gate",
        labelLt: "Vartai",
        descriptionLt: "įvažiavimo vartai automobiliui",
        synonyms: ["vartai", "vartų", "vartus", "slankiojantys vartai"],
      },
    ],
    pricingRules: [
      ...rules.pricingRules,
      {
        id: "price_gate",
        serviceId: "service_vartai",
        name: "Vartai pagal angos plotį",
        priceMin: 900,
        priceMax: 2800,
        unit: "€/vnt.",
        conditions: null,
        exclusions: null,
        disclaimerText: null,
        autoSendAllowed: true,
        active: true,
      },
    ],
  };
}
