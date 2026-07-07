import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLeadService,
  classifyLeadServiceWithFallback,
} from "../lib/leads/service-classifier";
import type { ClientRules } from "../lib/rules/types";

const aiEnv = { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" };

const rules: ClientRules = {
  services: [
    {
      id: "service_segmentine",
      name: "DEV Segmentinės tvoros montavimas",
      label: "Segmentinės tvoros montavimas",
      keywords: ["segmentinė", "segmentinės", "segmentai", "tvora", "tvoros"],
      active: true,
    },
    {
      id: "service_skardine",
      name: "DEV Skardinės tvoros gamyba ir montavimas",
      label: "Skardinės tvoros gamyba ir montavimas",
      keywords: ["skardinė", "skardinės", "skarda", "tvora", "tvoros"],
      active: true,
    },
    {
      id: "service_vartai",
      name: "DEV Vartai ir varteliai",
      label: "Vartai ir varteliai",
      keywords: ["vartai", "vartų", "vartus", "varteliai"],
      active: true,
    },
  ],
  serviceSubjects: [
    {
      serviceId: "service_segmentine",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "tvora, sklypo aptvėrimas segmentais",
      synonyms: ["tvora", "tvoros", "segmentai", "segmentinė"],
    },
    {
      serviceId: "service_skardine",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "skardinė tvora, sklypo aptvėrimas",
      synonyms: ["tvora", "tvoros", "skardinė", "skarda"],
    },
    {
      serviceId: "service_vartai",
      subjectKey: "gate",
      labelLt: "Vartai",
      descriptionLt: "įvažiavimo vartai automobiliui",
      synonyms: ["vartai", "vartų", "vartus", "slankiojantys vartai"],
    },
  ],
  pricingRules: [
    {
      id: "price_segmentine",
      serviceId: "service_segmentine",
      name: "Segmentinė tvora pagal metrą",
      priceMin: null,
      priceMax: null,
      unit: "€/m",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
    },
    {
      id: "price_skardine",
      serviceId: "service_skardine",
      name: "Skardinė tvora pagal metrą",
      priceMin: null,
      priceMax: null,
      unit: "€/m",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
    },
    {
      id: "price_vartai",
      serviceId: "service_vartai",
      name: "Vartai pagal angos plotį",
      priceMin: null,
      priceMax: null,
      unit: "€/vnt.",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
    },
  ],
  decisionRequirements: [],
  availabilityRules: [],
};

describe("classifyLeadService", () => {
  it("uses an explicitly selected active service as an override", () => {
    const classification = classifyLeadService({
      requestedServiceId: "service_segmentine",
      message: "Reikia vartų",
      rules,
    });

    assert.equal(classification.id, "service_segmentine");
    assert.equal(classification.source, "form_field");
    assert.equal(classification.confidence, 1);
  });

  it("detects a gate service from inflected Lithuanian wording", () => {
    const classification = classifyLeadService({
      requestedServiceId: "",
      message: "Labas, o turit pas save metalinių vartų?",
      rules,
    });

    assert.equal(classification.id, "service_vartai");
    assert.equal(classification.source, "deterministic");
    assert.ok(classification.confidence >= 0.7);
  });

  it("prefers skardine fence over generic fence services when the text is specific", () => {
    const classification = classifyLeadService({
      requestedServiceId: "",
      message: "Reikia skardinės tvoros 45 m ir 1.7 m aukščio.",
      rules,
    });

    assert.equal(classification.id, "service_skardine");
    assert.ok(classification.confidence >= 0.7);
  });

  it("leaves generic fence text ambiguous when multiple fence services match", () => {
    const classification = classifyLeadService({
      requestedServiceId: "",
      message: "Sveiki, reikia tvoros 45 m.",
      rules,
    });

    assert.equal(classification.id, null);
    assert.equal(classification.reason, "ambiguous");
    assert.ok(classification.confidence < 0.7);
  });
});

const singleServiceRules: ClientRules = {
  ...rules,
  services: [rules.services[0]],
  serviceSubjects: (rules.serviceSubjects ?? []).filter(
    (subject) => subject.serviceId === "service_segmentine",
  ),
  pricingRules: rules.pricingRules.filter(
    (rule) => rule.serviceId === "service_segmentine",
  ),
};

describe("classifyLeadServiceWithFallback", () => {
  it("keeps deterministic match first and does not call AI", async () => {
    let called = false;
    const { classification, ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Reikia skardinės tvoros 45 m ir 1.7 m aukščio.",
        rules,
      },
      {
        env: aiEnv,
        callModel: async () => {
          called = true;
          return "{}";
        },
      },
    );

    assert.equal(classification.id, "service_skardine");
    assert.equal(classification.source, "deterministic");
    assert.equal(ai.status, "skipped");
    assert.equal(ai.reason, "DETERMINISTIC_MATCH");
    assert.equal(called, false);
  });

  it("accepts an AI service when confidence and evidence pass on a no-match text", async () => {
    const { classification, ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, reikia aptvert sklypa nuo kaimyno.",
        rules,
      },
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            serviceId: "service_segmentine",
            confidence: 0.9,
            evidence: "aptvert sklypa",
          }),
      },
    );

    assert.equal(classification.id, "service_segmentine");
    assert.equal(classification.source, "ai");
    assert.equal(classification.reason, "ai_matched");
    assert.equal(classification.confidence, 0.9);
    assert.equal(ai.status, "ok");
  });

  it("rejects an AI service whose evidence is not in the text", async () => {
    const { classification, ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, reikia aptvert sklypa nuo kaimyno.",
        rules,
      },
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            serviceId: "service_segmentine",
            confidence: 0.95,
            evidence: "visiškai kitas tekstas kurio nėra",
          }),
      },
    );

    assert.equal(classification.id, null);
    assert.equal(classification.source, "deterministic");
    assert.equal(ai.status, "rejected");
    assert.equal(ai.reason, "EVIDENCE_NOT_FOUND");
  });

  it("rejects an AI service below the confidence threshold", async () => {
    const { ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, reikia aptvert sklypa nuo kaimyno.",
        rules,
      },
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            serviceId: "service_segmentine",
            confidence: 0.6,
            evidence: "aptvert sklypa",
          }),
      },
    );

    assert.equal(ai.status, "rejected");
    assert.equal(ai.reason, "LOW_CONFIDENCE");
  });

  it("rejects an AI service that is not in the active list", async () => {
    const { ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, reikia aptvert sklypa nuo kaimyno.",
        rules,
      },
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            serviceId: "service_nonexistent",
            confidence: 0.95,
            evidence: "aptvert sklypa",
          }),
      },
    );

    assert.equal(ai.status, "rejected");
    assert.equal(ai.reason, "SERVICE_NOT_IN_LIST");
  });

  it("does not auto-pick a single active service — AI must return null when nothing fits", async () => {
    const { classification, ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, ar dirbat savaitgaliais?",
        rules: singleServiceRules,
      },
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            serviceId: null,
            confidence: 0,
            evidence: "",
          }),
      },
    );

    assert.equal(classification.id, null);
    assert.equal(ai.status, "rejected");
    assert.equal(ai.reason, "NO_SERVICE");
  });

  it("skips AI without error when it is not configured (optional step)", async () => {
    let called = false;
    const { classification, ai } = await classifyLeadServiceWithFallback(
      {
        requestedServiceId: "",
        message: "Sveiki, reikia aptvert sklypa nuo kaimyno.",
        rules,
      },
      {
        env: {},
        callModel: async () => {
          called = true;
          return "{}";
        },
      },
    );

    assert.equal(classification.id, null);
    assert.equal(classification.source, "deterministic");
    assert.equal(ai.status, "skipped");
    assert.equal(ai.reason, "NOT_CONFIGURED");
    assert.equal(called, false);
  });
});
