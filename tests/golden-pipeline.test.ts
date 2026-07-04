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
        ["resolver_pass_1", "ok"],
        ["ai_gap_filler", "skipped"],
        ["decision", "ok"],
        ["composer", "ok"],
      ],
    );
  });

  it("stops with a clear config error when unresolved requirements need AI", async () => {
    await assert.rejects(
      () =>
        runTestLeadPipeline({
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
        }),
      (error) =>
        error instanceof AppConfigError &&
        error.message.includes(AI_NOT_CONFIGURED),
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
