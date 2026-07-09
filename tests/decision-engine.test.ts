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

  it("calculates a price estimate without lead time for price-only requests", () => {
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
    assert.equal(result.leadTime, null);
    assert.equal(result.autoSend, true);
    assert.deepEqual(result.autoSendBlockedBy, []);
  });

  it("answers an offering question from DB offering fields, ignoring unresolved requirements", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, primaryIntent: "asks_offering" },
      resolvedRequirements: {},
      unresolvedRequirements: [
        missing(
          "fence_length",
          "Tvoros ilgis",
          "Kiek metrų tvoros?",
          true,
          true,
        ),
      ],
      rules: {
        ...baseRules,
        services: [
          {
            ...baseRules.services[0],
            offeringDescription: "Taip, montuojame segmentines tvoras.",
            offeringFollowup: "Kiek metrų reikėtų?",
          },
        ],
      },
    });

    assert.equal(result.decision, "OFFERING_ANSWER");
    assert.equal(result.reason, "OFFERING_MATCHED");
    assert.deepEqual(result.offeringAnswer, {
      description: "Taip, montuojame segmentines tvoras.",
      followup: "Kiek metrų reikėtų?",
    });
    assert.deepEqual(result.questionsToAsk, []);
    assert.equal(result.autoSend, false);
  });

  it("manual-reviews an offering question when the service has no offering description", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, primaryIntent: "asks_offering" },
      resolvedRequirements: {},
      unresolvedRequirements: [],
    });

    assert.equal(result.decision, "MANUAL_REVIEW");
    assert.equal(result.reason, "OFFERING_NOT_CONFIGURED");
    assert.deepEqual(result.autoSendBlockedBy, ["OFFERING_NOT_CONFIGURED"]);
    assert.equal(result.offeringAnswer ?? null, null);
  });

  it("does not apply limited availability blockers to a price-only request", () => {
    const result = decideLeadResponse({
      ...baseInput,
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_limited",
            location: "Vilniaus rajone",
            status: "limited",
            earliestStartText: "Terminą tiksliname individualiai",
            autoSendAllowed: false,
          }),
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.matchedAvailabilityRule ?? null, null);
    assert.equal(result.leadTime, null);
    assert.equal(result.autoSend, true);
    assert.deepEqual(result.autoSendBlockedBy, []);
  });

  it("uses the region availability term instead of the schedule rule and exposes the match", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, asksAvailability: true },
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_vilnius",
            location: "Vilniaus rajone",
            status: "available",
            earliestStartText: "Per 2-4 savaites",
            autoSendAllowed: true,
          }),
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.leadTime?.text, "Per 2-4 savaites");
    assert.equal(result.matchedAvailabilityRule?.id, "avail_vilnius");
    assert.equal(result.autoSend, true);
  });

  it("prefers the exact region entry over the empty-location fallback", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, asksAvailability: true },
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_kitur",
            location: "",
            status: "limited",
            earliestStartText: "Terminas tikslinamas",
            autoSendAllowed: false,
          }),
          availabilityRule({
            id: "avail_vilnius",
            location: "Vilniaus rajone",
            status: "available",
            earliestStartText: "Per 2-4 savaites",
            autoSendAllowed: true,
          }),
        ],
      },
    });

    assert.equal(result.matchedAvailabilityRule?.id, "avail_vilnius");
    assert.equal(result.leadTime?.text, "Per 2-4 savaites");
  });

  it("falls back to the empty-location entry and blocks auto-send for limited status", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, asksAvailability: true },
      location: null,
      city: "Klaipėda",
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_vilnius",
            location: "Vilnius",
            status: "available",
            earliestStartText: "Per 2-4 savaites",
            autoSendAllowed: true,
          }),
          availabilityRule({
            id: "avail_kitur",
            location: "",
            status: "limited",
            earliestStartText: "Terminą tiksliname individualiai",
            autoSendAllowed: false,
          }),
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.matchedAvailabilityRule?.id, "avail_kitur");
    assert.equal(result.leadTime?.text, "Terminą tiksliname individualiai");
    assert.equal(result.autoSend, false);
    assert.ok(result.autoSendBlockedBy.includes("AVAILABILITY_LIMITED"));
    assert.ok(
      result.autoSendBlockedBy.includes("AVAILABILITY_AUTOSEND_DISABLED"),
    );
  });

  it("ignores expired availability entries and keeps the schedule fallback", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, asksAvailability: true },
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_expired",
            location: "Vilniaus rajone",
            status: "available",
            earliestStartText: "Per 1-2 savaites",
            autoSendAllowed: true,
            validUntil: "2026-01-01T00:00:00Z",
          }),
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.matchedAvailabilityRule ?? null, null);
    assert.equal(result.leadTime?.text, "3-5 sav.");
  });

  it("sends unavailable regions to manual review before asking questions", () => {
    const result = decideLeadResponse({
      ...baseInput,
      intents: { ...baseInput.intents, asksAvailability: true },
      resolvedRequirements: {},
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
      now: new Date("2026-07-09T00:00:00Z"),
      rules: {
        ...baseRules,
        availabilityRules: [
          availabilityRule({
            id: "avail_stop",
            location: "Vilniaus rajone",
            status: "unavailable",
            earliestStartText: null,
            autoSendAllowed: false,
          }),
        ],
      },
    });

    assert.equal(result.decision, "MANUAL_REVIEW");
    assert.equal(result.reason, "AVAILABILITY_UNAVAILABLE");
    assert.equal(result.matchedAvailabilityRule?.id, "avail_stop");
  });

  it("allows a verified AI-classified service above the confidence threshold", () => {
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.9,
        source: "ai",
        evidence: "segmentinė tvora",
        evidenceVerified: true,
        candidates: [{ id: "service_fence", confidence: 0.9 }],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.autoSend, true);
    assert.deepEqual(result.autoSendBlockedBy, []);
  });

  it("uses the evidence gate for legacy aiAllowedForAutoSend=false policies", () => {
    const policy = asRecord(baseRules.autosendPolicies?.[0]?.policy) ?? {};
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.9,
        source: "ai",
        evidence: "segmentinė tvora",
        evidenceVerified: true,
        candidates: [{ id: "service_fence", confidence: 0.9 }],
      },
      rules: {
        ...baseRules,
        autosendPolicies: [
          {
            policy: {
              ...policy,
              serviceClassification: { aiAllowedForAutoSend: false },
            },
          },
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.autoSend, true);
    assert.deepEqual(result.autoSendBlockedBy, []);
  });

  it("blocks an AI-classified service when evidence was not verified", () => {
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.9,
        source: "ai",
        evidence: "segmentinė tvora",
        evidenceVerified: false,
        candidates: [{ id: "service_fence", confidence: 0.9 }],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.autoSend, false);
    assert.ok(result.autoSendBlockedBy.includes("SERVICE_AI_EVIDENCE_BLOCKED"));
    assert.ok(!result.autoSendBlockedBy.includes("SERVICE_AI_CLASSIFIED"));
  });

  it("blocks an AI-classified service below the confidence threshold", () => {
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.7,
        source: "ai",
        evidence: "segmentinė tvora",
        evidenceVerified: true,
        candidates: [{ id: "service_fence", confidence: 0.7 }],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.autoSend, false);
    assert.ok(
      result.autoSendBlockedBy.includes("SERVICE_AI_CONFIDENCE_BLOCKED"),
    );
    assert.ok(!result.autoSendBlockedBy.includes("SERVICE_AI_CLASSIFIED"));
  });

  it("keeps the legacy unconditional allow policy for AI-classified services", () => {
    const policy = asRecord(baseRules.autosendPolicies?.[0]?.policy) ?? {};
    const result = decideLeadResponse({
      ...baseInput,
      service: {
        id: "service_fence",
        confidence: 0.9,
        source: "ai",
        candidates: [{ id: "service_fence", confidence: 0.9 }],
      },
      rules: {
        ...baseRules,
        autosendPolicies: [
          {
            policy: {
              ...policy,
              serviceClassification: { aiAllowedForAutoSend: true },
            },
          },
        ],
      },
    });

    assert.equal(result.decision, "PRICE_ESTIMATE");
    assert.equal(result.autoSend, true);
    assert.ok(!result.autoSendBlockedBy.includes("SERVICE_AI_CLASSIFIED"));
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

function availabilityRule(overrides: {
  id: string;
  location: string;
  status: string;
  earliestStartText: string | null;
  autoSendAllowed: boolean;
  validUntil?: string;
}) {
  return {
    id: overrides.id,
    serviceId: "service_fence",
    location: overrides.location,
    status: overrides.status,
    earliestStartText: overrides.earliestStartText,
    noteForCustomer: null,
    validUntil: overrides.validUntil ?? null,
    autoSendAllowed: overrides.autoSendAllowed,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

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
