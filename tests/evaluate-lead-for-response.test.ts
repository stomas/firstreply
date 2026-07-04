import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLeadForResponse } from "../lib/rules/evaluate-lead-for-response";
import type { ClientRules, EvaluationLead } from "../lib/rules/types";

const now = new Date("2026-07-03T12:00:00.000Z");

const baseRules: ClientRules = {
  services: [
    {
      id: "service_terrace",
      name: "Terasos montavimas",
      active: true,
    },
  ],
  pricingRules: [
    {
      id: "price_terrace",
      serviceId: "service_terrace",
      name: "Standartinė terasa",
      priceMin: 80,
      priceMax: 140,
      unit: "m2",
      conditions: { appliesTo: "standard" },
      exclusions: null,
      disclaimerText: "Tiksli kaina priklauso nuo objekto apžiūros.",
      autoSendAllowed: true,
      active: true,
    },
  ],
  decisionRequirements: [
    {
      id: "req_area",
      serviceId: "service_terrace",
      requirementKey: "area",
      label: "Plotas",
      requiredFor: "auto_send",
      questionTextIfMissing: "Kokio ploto terasa planuojama?",
      blocksAutoSend: true,
      priority: 10,
      active: true,
    },
  ],
  availabilityRules: [
    {
      id: "availability_vilnius",
      serviceId: "service_terrace",
      location: "Vilnius",
      status: "available",
      earliestStartText: "Per 2-3 savaites",
      noteForCustomer: "Tikslų laiką suderinsime po apžiūros.",
      validUntil: new Date("2026-08-01T00:00:00.000Z"),
      autoSendAllowed: true,
    },
  ],
};

const baseLead: EvaluationLead = {
  id: "lead_1",
  serviceId: "service_terrace",
  city: "Vilnius",
  originalMessage: "Domina terasos montavimas, plotas apie 24 m2.",
  parseResult: { area: "24 m2" },
  asksPrice: true,
  asksAvailability: true,
  isUrgent: false,
  hasAttachments: false,
};

describe("evaluateLeadForResponse", () => {
  it("creates a ready price and availability decision from real rules", async () => {
    const result = await evaluateLeadForResponse(baseLead, baseRules, {
      now,
      generateDraft: async () => "AI drafted response",
    });

    assert.equal(result.leadId, "lead_1");
    assert.equal(result.serviceId, "service_terrace");
    assert.equal(result.canGenerateResponse, true);
    assert.equal(result.autoSendAllowed, true);
    assert.equal(result.responseType, "price_availability");
    assert.equal(result.draftText, "AI drafted response");
    assert.deepEqual(
      result.matchedPricingRules.map((rule) => rule.id),
      ["price_terrace"],
    );
    assert.equal(result.matchedAvailabilityRule?.id, "availability_vilnius");
    assert.deepEqual(result.manualReviewReasons, []);
  });

  it("matches regional city text to the closest configured availability city", async () => {
    const result = await evaluateLeadForResponse(
      { ...baseLead, city: "Vilniaus rajonas" },
      baseRules,
      {
        now,
        generateDraft: async () => "AI drafted response",
      },
    );

    assert.equal(result.matchedAvailabilityRule?.id, "availability_vilnius");
    assert.deepEqual(result.manualReviewReasons, []);
  });

  it("requires manual review when blocking required information is missing", async () => {
    let draftWasRequested = false;

    const result = await evaluateLeadForResponse(
      { ...baseLead, parseResult: {} },
      baseRules,
      {
        now,
        generateDraft: async () => {
          draftWasRequested = true;
          return "should not be generated";
        },
      },
    );

    assert.equal(result.canGenerateResponse, false);
    assert.equal(result.autoSendAllowed, false);
    assert.equal(result.responseType, "missing_info");
    assert.deepEqual(result.missingRequirements, [
      {
        key: "area",
        label: "Plotas",
        question: "Kokio ploto terasa planuojama?",
      },
    ]);
    assert.deepEqual(result.manualReviewReasons, [
      "trūksta informacijos, kuri blokuoja auto-send: Plotas",
    ]);
    assert.equal(draftWasRequested, false);
  });

  it("uses deterministic facts to satisfy v2 expected fact requirements", async () => {
    const result = await evaluateLeadForResponse(
      {
        ...baseLead,
        parseResult: {
          facts: [
            {
              kind: "measurement",
              dimension: "length",
              value: 45,
              valueMin: null,
              valueMax: null,
              unit: "m",
              subject: null,
              negated: false,
            },
          ],
        },
      },
      {
        ...baseRules,
        decisionRequirements: [
          {
            id: "req_v2_length",
            serviceId: "service_terrace",
            requirementKey: "fence_length",
            label: "Tvoros ilgis",
            requiredFor: "auto_send",
            questionTextIfMissing: "Kiek metrų tvoros reikėtų?",
            blocksAutoSend: true,
            priority: 10,
            active: true,
            expectedFact: {
              kind: "measurement",
              subject: "fence",
              dimension: "length",
              units: ["m"],
            },
          },
        ],
      },
      {
        now,
        generateDraft: async () => "AI drafted response",
      },
    );

    assert.deepEqual(result.missingRequirements, []);
    assert.deepEqual(result.manualReviewReasons, []);
    assert.equal(result.canGenerateResponse, true);
  });

  it("requires manual review when the selected service is not active", async () => {
    const result = await evaluateLeadForResponse(
      baseLead,
      { ...baseRules, services: [] },
      { now, generateDraft: async () => "should not be generated" },
    );

    assert.equal(result.canGenerateResponse, false);
    assert.equal(result.autoSendAllowed, false);
    assert.equal(result.responseType, "manual_review");
    assert.deepEqual(result.manualReviewReasons, ["nėra aktyvios paslaugos"]);
    assert.equal(result.draftText, null);
  });

  it("does not fake a draft when AI generation is not configured", async () => {
    const result = await evaluateLeadForResponse(baseLead, baseRules, {
      now,
      generateDraft: async () => {
        throw new Error("AI generation is not configured.");
      },
    });

    assert.equal(result.canGenerateResponse, false);
    assert.equal(result.autoSendAllowed, false);
    assert.equal(result.responseType, "manual_review");
    assert.equal(result.draftText, null);
    assert.deepEqual(result.manualReviewReasons, [
      "AI generation is not configured.",
    ]);
  });
});
