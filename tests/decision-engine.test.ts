import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideLeadResponse } from "../lib/decision/engine";
import type {
  ClientRules,
  DecisionEngineInput,
  ResolvedRequirementValue,
} from "../lib/rules/types";

const baseRules: ClientRules = {
  services: [
    {
      id: "service_fence",
      name: "Segmentinės tvoros",
      active: true,
    },
  ],
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
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        pricePerUnit: 38,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
        modifiers: [
          {
            if: { requirementKey: "fence_height", gte: 1.7 },
            pricePerUnitDelta: 6,
          },
        ],
      },
    },
  ],
  decisionRequirements: [],
  availabilityRules: [],
  locationZones: [
    {
      adminUnitCode: "vilniaus_r_sav",
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
};

const baseInput: DecisionEngineInput = {
  service: {
    id: "service_fence",
    confidence: 1,
    candidates: [{ id: "service_fence", confidence: 1 }],
  },
  location: {
    raw: "Vilniaus rajone",
    adminUnit: {
      type: "municipality",
      code: "vilniaus_r_sav",
      label: "Vilniaus r. sav.",
    },
    confidence: 1,
    source: "deterministic",
  },
  intents: {
    asksPrice: true,
    asksAvailability: false,
    isUrgent: false,
  },
  resolvedRequirements: {
    fence_length: resolvedNumber(45, "m", "fact_1"),
    fence_height: resolvedNumber(1.7, "m", "fact_2"),
  },
  unresolvedRequirements: [],
  conflicts: [],
  rules: baseRules,
};

describe("decideLeadResponse", () => {
  it("sends conflicts to manual review before any other decision", () => {
    const result = decideLeadResponse({
      ...baseInput,
      conflicts: [
        {
          requirementKey: "fence_length",
          factRefs: ["fact_1", "fact_2"],
          reason: "MULTIPLE_FACTS_FOR_REQUIREMENT",
        },
      ],
      unresolvedRequirements: [
        {
          requirementKey: "fence_length",
          label: "Tvoros ilgis",
          question: "Kiek metrų tvoros reikėtų?",
          required: true,
          affectsPrice: true,
          status: "conflict",
          candidateFactRefs: ["fact_1", "fact_2"],
        },
      ],
    });

    assert.equal(result.decision, "MANUAL_REVIEW");
    assert.equal(result.reason, "CONFLICTS");
    assert.deepEqual(result.autoSendBlockedBy, ["CONFLICTS"]);
  });

  it("sends low-confidence service classification to manual review", () => {
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.6,
        candidates: [{ id: "service_fence", confidence: 0.6 }],
      },
    });

    assert.equal(result.decision, "MANUAL_REVIEW");
    assert.equal(result.reason, "SERVICE_AMBIGUOUS");
  });

  it("declines when the parsed municipality is not served", () => {
    const result = decideLeadResponse({
      ...baseInput,
      location: {
        raw: "Klaipėdoje",
        adminUnit: {
          type: "municipality",
          code: "klaipedos_m_sav",
          label: "Klaipėdos m. sav.",
        },
        confidence: 1,
        source: "deterministic",
      },
    });

    assert.equal(result.decision, "DECLINE_TEMPLATE");
    assert.equal(result.reason, "LOCATION_NOT_SERVED");
    assert.equal(result.autoSend, false);
  });

  it("asks up to three required missing questions, prioritizing price-affecting ones", () => {
    const result = decideLeadResponse({
      ...baseInput,
      unresolvedRequirements: [
        missing(
          "gate_width",
          "Vartų plotis",
          "Koks vartų plotis?",
          false,
          true,
        ),
        missing(
          "fence_height",
          "Tvoros aukštis",
          "Koks tvoros aukštis?",
          true,
          true,
        ),
        missing("color", "Spalva", "Kokia spalva?", true, false),
        missing(
          "fence_length",
          "Tvoros ilgis",
          "Kiek metrų tvoros?",
          true,
          true,
        ),
        missing("deadline", "Terminas", "Kada reikia?", true, false),
      ],
    });

    assert.equal(result.decision, "ASK_MISSING_INFO");
    assert.equal(result.reason, "MISSING_REQUIRED_REQUIREMENTS");
    assert.deepEqual(result.questionsToAsk, [
      "Koks tvoros aukštis?",
      "Kiek metrų tvoros?",
      "Kokia spalva?",
    ]);
    assert.equal(result.autoSend, false);
  });

  it("calculates a price estimate only from pricing_rules JSON and schedule rules", () => {
    const result = decideLeadResponse(baseInput);

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.reason, "PRICE_RULE_MATCHED");
    assert.deepEqual(result.priceEstimate, {
      pricingRuleId: "price_fence_per_m",
      currency: "EUR",
      unit: "m",
      quantity: 45,
      unitPrice: 44,
      amount: 1980,
    });
    assert.deepEqual(result.leadTime, {
      minWeeks: 3,
      maxWeeks: 5,
      text: "3-5 sav.",
    });
    assert.equal(result.autoSend, true);
    assert.deepEqual(result.autoSendBlockedBy, []);
  });

  it("manual-reviews when all required data is present but no pricing rule matches", () => {
    const result = decideLeadResponse({
      ...baseInput,
      rules: {
        ...baseRules,
        pricingRules: [],
      },
    });

    assert.equal(result.decision, "MANUAL_REVIEW");
    assert.equal(result.reason, "NO_PRICING_RULE");
    assert.equal(result.priceEstimate, null);
    assert.equal(result.autoSend, false);
  });
});

function resolvedNumber(
  value: number,
  unit: string,
  factRef: string,
): ResolvedRequirementValue {
  return {
    value,
    valueMin: null,
    valueMax: null,
    unit,
    factRef,
    source: "deterministic",
    subjectSource: "ai",
    confidence: 0.98,
    validationPassed: true,
  };
}

function missing(
  requirementKey: string,
  label: string,
  question: string,
  required: boolean,
  affectsPrice: boolean,
) {
  return {
    requirementKey,
    label,
    question,
    required,
    affectsPrice,
    status: "unresolved" as const,
    candidateFactRefs: [],
  };
}
