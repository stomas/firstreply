import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppConfigError } from "../lib/app-errors";
import { composeResponseDraft } from "../lib/response/composer";
import type {
  ClientRules,
  DecisionResult,
  ResolvedRequirementValue,
} from "../lib/rules/types";

const baseRules: ClientRules = {
  services: [],
  pricingRules: [
    {
      id: "price_fence_per_m",
      serviceId: "service_fence",
      name: "Segmentinė tvora pagal metrą",
      priceMin: null,
      priceMax: null,
      unit: "€/m",
      conditions: null,
      exclusions: null,
      autoSendAllowed: true,
      disclaimerText: null,
      active: true,
      rule: {
        type: "per_unit",
        requires: ["fence_length", "fence_height"],
      },
    },
  ],
  decisionRequirements: [
    {
      id: "req_fence_length",
      serviceId: "service_fence",
      requirementKey: "fence_length",
      label: "Tvoros ilgis",
      requiredFor: "auto_send",
      questionTextIfMissing: "Kiek metrų tvoros reikėtų?",
      blocksAutoSend: true,
      priority: 10,
      active: true,
      required: true,
      affectsPrice: true,
    },
    {
      id: "req_fence_height",
      serviceId: "service_fence",
      requirementKey: "fence_height",
      label: "Tvoros aukštis",
      requiredFor: "auto_send",
      questionTextIfMissing: "Koks tvoros aukštis?",
      blocksAutoSend: true,
      priority: 20,
      active: true,
      required: true,
      affectsPrice: true,
    },
  ],
  availabilityRules: [],
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
};

describe("composeResponseDraft", () => {
  it("renders missing-info questions from the DB template", () => {
    const result = composeResponseDraft({
      decisionResult: {
        decision: "ASK_MISSING_INFO",
        reason: "MISSING_REQUIRED_REQUIREMENTS",
        priceEstimate: null,
        leadTime: null,
        questionsToAsk: [
          "Kiek metrų segmentinės tvoros reikėtų?",
          "Kokio aukščio segmentų norėtumėte?",
        ],
        autoSend: false,
        autoSendBlockedBy: ["REQUIRED_REQUIREMENTS_UNRESOLVED"],
      },
      rules: baseRules,
      resolvedRequirements: {},
      isTest: false,
    });

    assert.equal(
      result.draftText,
      "Sveiki, patikslinkite: Kiek metrų segmentinės tvoros reikėtų? Kokio aukščio segmentų norėtumėte?",
    );
    assert.equal(result.responseType, "missing_info");
    assert.equal(result.autoSendAllowed, false);
  });

  it("renders a price estimate from DB values but blocks auto-send for test leads", () => {
    const result = composeResponseDraft({
      decisionResult: priceDecision(),
      rules: baseRules,
      resolvedRequirements: {
        fence_length: resolvedRequirement("deterministic", 0.98),
        fence_height: resolvedRequirement("deterministic", 0.98),
      },
      isTest: true,
    });

    assert.equal(
      result.draftText,
      "Sveiki, orientacinė kaina: 1980 EUR. Terminas: 3-5 sav..",
    );
    assert.equal(result.responseType, "price_estimate");
    assert.equal(result.autoSendAllowed, false);
    assert.deepEqual(result.autoSendBlockedBy, ["TEST_LEAD"]);
  });

  it("blocks auto-send when price-affecting AI requirements fail policy gates", () => {
    const result = composeResponseDraft({
      decisionResult: priceDecision(),
      rules: baseRules,
      resolvedRequirements: {
        fence_length: resolvedRequirement("ai", 0.7),
        fence_height: resolvedRequirement("deterministic", 0.98),
      },
      isTest: false,
    });

    assert.equal(result.autoSendAllowed, false);
    assert.deepEqual(result.autoSendBlockedBy, [
      "PRICE_REQUIREMENT_SOURCE_BLOCKED:fence_length",
      "PRICE_REQUIREMENT_CONFIDENCE_BLOCKED:fence_length",
    ]);
  });

  it("stops with a clear config error when the needed DB template is missing", () => {
    assert.throws(
      () =>
        composeResponseDraft({
          decisionResult: priceDecision(),
          rules: { ...baseRules, responseTemplates: [] },
          resolvedRequirements: {
            fence_length: resolvedRequirement("deterministic", 0.98),
          },
          isTest: false,
        }),
      (error) =>
        error instanceof AppConfigError &&
        error.message.includes("Response template not found"),
    );
  });
});

function priceDecision(): DecisionResult {
  return {
    decision: "PRICE_ESTIMATE",
    reason: "PRICE_RULE_MATCHED",
    priceEstimate: {
      pricingRuleId: "price_fence_per_m",
      currency: "EUR",
      unit: "m",
      quantity: 45,
      unitPrice: 44,
      amount: 1980,
    },
    leadTime: {
      minWeeks: 3,
      maxWeeks: 5,
      text: "3-5 sav.",
    },
    questionsToAsk: [],
    autoSend: true,
    autoSendBlockedBy: [],
  };
}

function resolvedRequirement(
  source: string,
  confidence: number,
): ResolvedRequirementValue {
  return {
    value: 45,
    unit: "m",
    factRef: "fact_1",
    source,
    subjectSource: source,
    confidence,
    validationPassed: true,
    evidenceVerified: true,
  };
}
