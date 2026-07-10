import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runTestLeadPipeline } from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type { ClientRules, DecisionRequirement } from "../lib/rules/types";

const llmEnv = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "test-model",
  LLM_FIRST_PARSE: "true",
};

describe("LLM-first test lead parsing", () => {
  it("extracts a complete quote request from LLM JSON and keeps business outputs deterministic", async () => {
    const calls: string[] = [];

    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "segmentinė tvora, 85 m, 1.5 m, Avižieniai, su varteliais, be vartų, nori kainos ir atvykimo datos",
      },
      rules,
      leadId: "llm_happy",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async (request) => {
          calls.push(request.user);
          return JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: true,
              asksAvailability: true,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: {
              raw: "Avižieniai",
              adminUnitCode: null,
              confidence: 0.8,
              evidence: "Avižieniai",
            },
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "85 m",
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "1.5 m",
              }),
            ],
            missingFields: [],
          });
        },
      },
    });

    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("service_dev_segmentines_tvoros"));
    assert.ok(calls[0].includes("fence_length"));
    assert.equal(result.parsedLead.serviceId, "service_dev_segmentines_tvoros");
    assert.equal(result.parsedLead.parserVersion, "lead_parse_v3_llm_first");
    assert.equal(result.parsedLead.location, null);
    assert.equal(
      result.parsedLead.resolvedRequirements.fence_length?.source,
      "ai",
    );
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.priceEstimate?.amount, 850);
    assert.equal(result.decisionResult.leadTime?.text, "3-5 sav.");
    assert.equal(
      result.trace.stages.find((stage) => stage.key === "ai_gap_filler")
        ?.status,
      "skipped",
    );
  });

  it("rejects a concrete AI service when evidence only names a generic fence category", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Laba diena, kiek kainuotų tvora namui? Reikia aplink kiemą, domina pigesnis variantas. Gal galite parašyti kainą?",
      },
      rules,
      leadId: "llm_generic_fence",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "tvora",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(result.parsedLead.serviceClassification?.id, null);
    assert.deepEqual(result.parsedLead.serviceClassification?.candidates, [
      {
        id: "service_dev_segmentines_tvoros",
        confidence: 0.6,
        score: 0,
        matchedTerms: ["tvora"],
      },
    ]);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(result.decisionResult.reason, "SERVICE_AMBIGUOUS");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio tipo tvorą svarstote?",
    ]);
    assert.equal(
      result.evaluation.draftText,
      "Patikslinkite: Kokio tipo tvorą svarstote?",
    );
    const rejectedFindings = (
      result.trace.stages[0]?.data as {
        rejectedFindings: Array<{ reason: string; target: string }>;
      }
    ).rejectedFindings;
    assert.equal(
      rejectedFindings.some(
        (finding) =>
          finding.target === "service_dev_segmentines_tvoros" &&
          finding.reason === "SERVICE_EVIDENCE_NOT_SPECIFIC",
      ),
      true,
    );
  });

  it("manual-reviews a specific unsupported fence type instead of asking for the type", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, norėčiau tvoros Kaune. Galvoju apie metalinę horizontalią tvorą, apie 40 metrų. Reikėtų ir vartų automatikos. Kiek maždaug kainuotų?",
      },
      rules,
      leadId: "llm_unsupported_horizontal_metal_fence",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "metalinę horizontalią tvorą",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 40,
                evidence: "apie 40 metrų",
              }),
            ],
            missingFields: ["fence_height"],
          }),
      },
    });

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "unsupported_specific_service",
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.deepEqual(result.decisionResult.questionsToAsk, []);
    assert.equal(result.responseType, "manual_review");
    assert.equal(result.autoSendAllowed, false);
    assert.equal(
      result.evaluation.draftText,
      "Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „metalinę horizontalią tvorą“. Šiuo metu tokios paslaugos neteikiame.",
    );
    assert.deepEqual(result.evaluation.manualReviewReasons, [
      "SERVICE_UNSUPPORTED; TEST_LEAD",
    ]);
  });

  it("manual-reviews an unsupported fence type even when LLM evidence names only the generic word", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, norėčiau tvoros Kaune. Galvoju apie metalinę horizontalią tvorą, apie 40 metrų. Reikėtų ir vartų automatikos. Kiek maždaug kainuotų?",
      },
      rules,
      leadId: "llm_unsupported_generic_evidence",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "tvoros",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "unsupported_specific_service",
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.equal(result.responseType, "manual_review");
    assert.equal(
      result.evaluation.draftText,
      "Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „metalinę horizontalią tvorą“. Šiuo metu tokios paslaugos neteikiame.",
    );
  });

  it("manual-reviews an unsupported fence type when LLM returns no service at all", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, norėčiau tvoros Kaune. Galvoju apie metalinę horizontalią tvorą, apie 40 metrų. Kiek maždaug kainuotų?",
      },
      rules,
      leadId: "llm_unsupported_no_service",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: null,
            serviceEvidence: null,
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "unsupported_specific_service",
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.equal(
      result.evaluation.draftText,
      "Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „metalinę horizontalią tvorą“. Šiuo metu tokios paslaugos neteikiame.",
    );
  });

  it("detects availability and urgency deterministically when the LLM misses them", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        asksPrice: false,
        inquiryMessage:
          "Sveiki, ar galėtumėte įrengti tvorą dar šį mėnesį? Objektas Trakuose, reikia apie 60 m segmentinės tvoros, 1,7 m aukščio, su stulpais ir montavimu. Vartai nereikalingi. Labai svarbu terminas, nes atsikraustom su šunimi.",
      },
      rules,
      leadId: "llm_urgent_intent_missed",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinės tvoros",
            intents: {
              asksPrice: false,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 60,
                evidence: "apie 60 m segmentinės tvoros",
                confidence: 0.98,
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.7,
                evidence: "1,7 m aukščio",
                confidence: 0.99,
              }),
              {
                requirementKey: "gate_width",
                kind: "selection",
                subject: "gate",
                dimension: null,
                value: false,
                valueMin: null,
                valueMax: null,
                unit: null,
                evidence: "Vartai nereikalingi",
                confidence: 0.99,
                negated: true,
              },
            ],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.parsedLead.asksAvailability, true);
    assert.equal(result.parsedLead.isUrgent, true);
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.leadTime?.text, "3-5 sav.");
    assert.equal(result.draftText, "Kaina: 600 EUR. Terminas: 3-5 sav.");
    assert.equal(result.autoSendAllowed, false);
    assert.ok(result.composed?.autoSendBlockedBy.includes("URGENT"));
  });

  it("accepts a horizontal metal fence as skardine fence evidence", async () => {
    const calls: string[] = [];
    const skardineRules = rulesWithSkardineFence();

    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, norėčiau tvoros Kaune. Galvoju apie metalinę horizontalią tvorą, apie 40 metrų. Reikėtų ir vartų automatikos. Kiek maždaug kainuotų?",
      },
      rules: skardineRules,
      leadId: "llm_horizontal_metal_fence",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async (request) => {
          calls.push(request.user);
          return JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_skardines_tvoros",
            serviceEvidence: "metalinę horizontalią tvorą",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 40,
                evidence: "apie 40 metrų",
              }),
            ],
            missingFields: ["fence_height"],
          });
        },
      },
    });

    assert.ok(calls[0].includes("horizontalias"));
    assert.equal(result.parsedLead.serviceId, "service_dev_skardines_tvoros");
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio aukscio skardines tvoros noretumete?",
    ]);
  });

  it("asks configured missing-field questions without running the gap filler rescue pass", async () => {
    let calls = 0;

    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        inquiryMessage:
          "segmentinė tvora, 85 m, Avižieniai, nori kainos ir atvykimo datos",
      },
      rules,
      leadId: "llm_missing",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async (request) => {
          calls += 1;
          if (calls > 1 || request.user.includes("existingFacts")) {
            throw new Error(
              "AI gap filler should not run after LLM-first parse",
            );
          }

          return JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: true,
              asksAvailability: true,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: {
              raw: "Avižieniai",
              adminUnitCode: null,
              confidence: 0.8,
              evidence: "Avižieniai",
            },
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "85 m",
              }),
            ],
            missingFields: ["fence_height"],
          });
        },
      },
    });

    assert.equal(calls, 1);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio aukscio segmentu noretumete?",
    ]);
    assert.equal(
      result.trace.stages.find((stage) => stage.key === "ai_gap_filler")
        ?.summary,
      "AI praleistas: LLM-first parse jau yra autoritetingas",
    );
  });

  it("normalizes placeholder zero confidence on otherwise verified LLM facts", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, domina segmentinė tvora aplink sklypą Vilniaus rajone, Avižieniuose. Reikėtų apie 85 metrus tvoros, aukštis 1,5 m. Kokia būtų preliminari kaina ir kada galėtumėte atvykti?",
      },
      rules,
      leadId: "llm_placeholder_confidence",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: false,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: {
              raw: "Vilniaus rajone, Avižieniuose",
              adminUnitCode: null,
              confidence: 0,
              evidence: "Vilniaus rajone, Avižieniuose",
            },
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "Reikėtų apie 85 metrus tvoros",
                confidence: 0,
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "aukštis 1,5 m",
                confidence: 0,
              }),
            ],
            missingFields: [],
          }),
      },
    });

    assert.equal(
      result.parsedLead.resolvedRequirements.fence_length?.confidence,
      0.9,
    );
    assert.equal(
      result.parsedLead.resolvedRequirements.fence_height?.confidence,
      0.9,
    );
    assert.equal(result.parsedLead.asksPrice, true);
    assert.equal(
      result.composed?.autoSendBlockedBy.some(
        (reason) =>
          reason.startsWith("PRICE_REQUIREMENT_SOURCE_BLOCKED") ||
          reason.startsWith("PRICE_REQUIREMENT_CONFIDENCE_BLOCKED") ||
          reason === "CONFIDENCE_BELOW_AUTOSEND_BAND",
      ),
      false,
    );
  });

  it("marks an explicitly negated optional subject requirement as not applicable", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, domina segmentinė tvora aplink sklypą Vilniaus rajone, Avižieniuose. Reikėtų apie 85 metrus tvoros, aukštis 1,5 m. Norėčiau su montavimu, be vartų, tik vieni varteliai. Sklypas lygus, gruntas normalus, ne molis. Kokia būtų preliminari kaina ir kada galėtumėte atvykti?",
      },
      rules,
      leadId: "llm_optional_gate_opt_out",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: false,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: {
              raw: "Vilniaus rajone, Avižieniuose",
              adminUnitCode: null,
              confidence: 0,
              evidence: "Vilniaus rajone, Avižieniuose",
            },
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "Reikėtų apie 85 metrus tvoros",
                confidence: 0,
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "aukštis 1,5 m",
                confidence: 0,
              }),
            ],
            missingFields: ["gate_width"],
          }),
      },
    });

    assert.equal(
      result.parsedLead.resolvedRequirements.gate_width?.value,
      false,
    );
    assert.equal(
      result.parsedLead.resolvedRequirements.gate_width?.source,
      "deterministic",
    );
    assert.equal(
      result.parsedLead.unresolvedRequirements.some(
        (requirement) => requirement.requirementKey === "gate_width",
      ),
      false,
    );
    assert.equal(
      result.evaluation.missingRequirements.some(
        (requirement) => requirement.key === "gate_width",
      ),
      false,
    );
  });

  it("accepts LLM-provided optional subject opt-out facts", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Segmentinė tvora 85 m, aukštis 1,5 m, be vartų. Kokia kaina?",
      },
      rules,
      leadId: "llm_optional_gate_opt_out_fact",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "Segmentinė tvora",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "85 m",
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "aukštis 1,5 m",
              }),
              {
                requirementKey: "gate_width",
                kind: "selection",
                subject: "gate",
                dimension: null,
                value: false,
                valueMin: null,
                valueMax: null,
                unit: null,
                evidence: "be vartų",
                confidence: 0.95,
                negated: true,
              },
            ],
            missingFields: [],
          }),
      },
    });

    assert.equal(
      result.parsedLead.resolvedRequirements.gate_width?.value,
      false,
    );
    assert.equal(
      result.parsedLead.resolvedRequirements.gate_width?.source,
      "ai",
    );
    assert.deepEqual(result.trace.stages[0]?.data.rejectedFindings, []);
    assert.equal(
      result.evaluation.missingRequirements.some(
        (requirement) => requirement.key === "gate_width",
      ),
      false,
    );
  });

  it("does not apply availability blockers when a quote request does not ask availability", async () => {
    const rulesWithLimitedAvailability: ClientRules = {
      ...rules,
      availabilityRules: [
        {
          id: "avail_limited",
          serviceId: "service_dev_segmentines_tvoros",
          location: "Vilniaus rajone",
          status: "limited",
          earliestStartText: "Terminą tiksliname individualiai",
          noteForCustomer: null,
          validUntil: null,
          autoSendAllowed: false,
        },
      ],
    };
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        city: "",
        inquiryMessage:
          "Sveiki, domina segmentinė tvora aplink sklypą Vilniaus rajone, Avižieniuose. Reikėtų apie 85 metrus tvoros, aukštis 1,5 m. Norėčiau su montavimu, be vartų, tik vieni varteliai. Sklypas lygus, gruntas normalus, ne molis. Kokia būtų preliminari kaina?",
      },
      rules: rulesWithLimitedAvailability,
      leadId: "llm_price_only_no_availability",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: false,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: {
              raw: "Vilniaus rajone, Avižieniuose",
              adminUnitCode: null,
              confidence: 0,
              evidence: "Vilniaus rajone, Avižieniuose",
            },
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "Reikėtų apie 85 metrus tvoros",
                confidence: 0,
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "aukštis 1,5 m",
                confidence: 0,
              }),
            ],
            missingFields: ["gate_width"],
          }),
      },
    });

    assert.equal(result.parsedLead.asksAvailability, false);
    assert.equal(result.decisionResult.matchedAvailabilityRule ?? null, null);
    assert.equal(result.decisionResult.leadTime, null);
    assert.equal(result.draftText?.includes("Terminas"), false);
    assert.equal(result.draftText?.includes("3-5 sav."), false);
    assert.equal(
      result.composed?.autoSendBlockedBy.some((reason) =>
        reason.startsWith("AVAILABILITY_"),
      ),
      false,
    );
    assert.equal(
      result.composed?.autoSendBlockedBy.includes("SERVICE_AI_CLASSIFIED"),
      false,
    );
  });

  it("keeps out-of-range LLM facts in the structured conflict flow", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        inquiryMessage: "segmentinė tvora, 85 m, 9 m aukščio, nori kainos",
      },
      rules,
      leadId: "llm_range_conflict",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "85 m",
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 9,
                evidence: "9 m aukščio",
              }),
            ],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(result.decisionResult.reason, "VALIDATION_FAILED");
    assert.deepEqual(result.parsedLead.conflicts, [
      {
        requirementKey: "fence_height",
        factRefs: ["llm_fact_2"],
        reason: "VALUE_OUT_OF_RANGE",
        clarificationQuestion:
          "Nurodytas 9 m aukštis viršija įprastą 0,8–3 m ribą. Ar galite patikslinti planuojamą aukštį?",
      },
    ]);
    assert.equal(result.responseStatus, "ready");
  });

  it("ignores LLM-provided price and ETA fields", async () => {
    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        inquiryMessage: "segmentinė tvora 85 m ir 1.5 m, kiek kainuos?",
      },
      rules,
      leadId: "llm_business_output_ignored",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_dev_segmentines_tvoros",
            serviceEvidence: "segmentinė tvora",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              llmFact({
                requirementKey: "fence_length",
                dimension: "length",
                value: 85,
                evidence: "85 m",
              }),
              llmFact({
                requirementKey: "fence_height",
                dimension: "height",
                value: 1.5,
                evidence: "1.5 m",
              }),
            ],
            missingFields: [],
            priceEstimate: { amount: 123456, currency: "EUR" },
            eta: "rytoj",
          }),
      },
    });

    assert.equal(result.decisionResult.priceEstimate?.amount, 850);
    assert.equal(result.decisionResult.leadTime, null);
    assert.equal(result.draftText?.includes("Terminas"), false);
    assert.equal(result.draftText?.includes("123456"), false);
    assert.equal(result.draftText?.includes("rytoj"), false);
  });

  it("supports a synthetic service and requirement from ClientRules without extractor code changes", async () => {
    const customRules: ClientRules = {
      ...rules,
      services: [
        ...rules.services,
        {
          id: "service_custom_pergola",
          name: "Pergolos",
          label: "Pergolos",
          keywords: [],
          active: true,
        },
      ],
      serviceSubjects: [
        ...(rules.serviceSubjects ?? []),
        {
          serviceId: "service_custom_pergola",
          subjectKey: "pergola",
          labelLt: "Pergola",
          descriptionLt: "lauko pergola",
          synonyms: ["pergola"],
        },
      ],
      decisionRequirements: [
        ...rules.decisionRequirements,
        requirement({
          id: "req_pergola_area",
          serviceId: "service_custom_pergola",
          requirementKey: "pergola_area",
          label: "Pergolos plotas",
          question: "Koks pergolos plotas kvadratiniais metrais?",
          subject: "pergola",
          dimension: "area",
          units: ["m2"],
          min: 1,
          max: 100,
        }),
      ],
      pricingRules: [
        ...rules.pricingRules,
        {
          id: "price_pergola_per_m2",
          serviceId: "service_custom_pergola",
          name: "Pergola pagal plotą",
          priceMin: 20,
          priceMax: 20,
          unit: "EUR/m2",
          conditions: null,
          exclusions: null,
          disclaimerText: null,
          autoSendAllowed: true,
          active: true,
          rule: {
            type: "per_unit",
            requirementKey: "pergola_area",
            unit: "m2",
            pricePerUnit: 20,
            currency: "EUR",
            requires: ["pergola_area"],
          },
        },
      ],
    };

    const result = await runTestLeadPipeline({
      input: {
        ...baseInput(),
        serviceId: "",
        inquiryMessage: "Reikia pergolos 12 m2, kiek kainuos?",
      },
      rules: customRules,
      leadId: "llm_synthetic",
      isTest: true,
      aiOptions: {
        env: llmEnv,
        callModel: async () =>
          JSON.stringify({
            schemaVersion: "lead_parse_v3_llm_first",
            serviceId: "service_custom_pergola",
            serviceEvidence: "pergolos",
            intents: {
              asksPrice: true,
              asksAvailability: false,
              isUrgent: false,
              primaryIntent: "requests_quote",
            },
            location: null,
            facts: [
              {
                requirementKey: "pergola_area",
                kind: "measurement",
                subject: "pergola",
                dimension: "area",
                value: 12,
                valueMin: null,
                valueMax: null,
                unit: "m2",
                evidence: "12 m2",
                confidence: 0.95,
                negated: false,
              },
            ],
            missingFields: [],
          }),
      },
    });

    assert.equal(result.parsedLead.serviceId, "service_custom_pergola");
    assert.equal(result.decisionResult.priceEstimate?.amount, 240);
    assert.equal(
      result.parsedLead.resolvedRequirements.pergola_area?.source,
      "ai",
    );
  });
});

function baseInput(): TestInquiryInput {
  return {
    serviceId: "service_dev_segmentines_tvoros",
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

function llmFact(overrides: {
  requirementKey: "fence_length" | "fence_height";
  dimension: "length" | "height";
  value: number;
  evidence: string;
  confidence?: number;
}) {
  return {
    requirementKey: overrides.requirementKey,
    kind: "measurement",
    subject: "fence",
    dimension: overrides.dimension,
    value: overrides.value,
    valueMin: null,
    valueMax: null,
    unit: "m",
    evidence: overrides.evidence,
    confidence: overrides.confidence ?? 0.95,
    negated: false,
  };
}

function requirement(params: {
  id: string;
  serviceId: string;
  requirementKey: string;
  label: string;
  question: string;
  subject: string;
  dimension: "length" | "width" | "height" | "area";
  units: string[];
  min: number;
  max: number;
}): DecisionRequirement {
  return {
    id: params.id,
    serviceId: params.serviceId,
    requirementKey: params.requirementKey,
    label: params.label,
    requiredFor: "auto_send",
    questionTextIfMissing: params.question,
    blocksAutoSend: true,
    priority: params.dimension === "length" ? 10 : 20,
    active: true,
    required: true,
    affectsPrice: true,
    expectedFact: {
      kind: "measurement",
      subject: params.subject,
      dimension: params.dimension,
      units: params.units,
    },
    validation: { min: params.min, max: params.max },
  };
}

const rules: ClientRules = {
  services: [
    {
      id: "service_dev_segmentines_tvoros",
      name: "DEV Segmentines tvoros montavimas",
      label: "Segmentines tvoros montavimas",
      keywords: ["segmentine", "tvora"],
      active: true,
    },
  ],
  serviceSubjects: [
    {
      serviceId: "service_dev_segmentines_tvoros",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "tvora, sklypo aptverimas segmentais",
      synonyms: ["tvora", "segmentine"],
    },
    {
      serviceId: "service_dev_segmentines_tvoros",
      subjectKey: "gate",
      labelLt: "Vartai",
      descriptionLt: "ivaziavimo vartai",
      synonyms: ["vartai", "vartų", "vartus", "vartu"],
    },
  ],
  pricingRules: [
    {
      id: "price_segmentine_per_m",
      serviceId: "service_dev_segmentines_tvoros",
      name: "Segmentine tvora pagal metra",
      priceMin: 10,
      priceMax: 10,
      unit: "EUR/m",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        pricePerUnit: 10,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
      },
    },
  ],
  decisionRequirements: [
    requirement({
      id: "req_segmentine_fence_length",
      serviceId: "service_dev_segmentines_tvoros",
      requirementKey: "fence_length",
      label: "Tvoros ilgis",
      question: "Kiek metru segmentines tvoros reiketu?",
      subject: "fence",
      dimension: "length",
      units: ["m"],
      min: 1,
      max: 500,
    }),
    requirement({
      id: "req_segmentine_fence_height",
      serviceId: "service_dev_segmentines_tvoros",
      requirementKey: "fence_height",
      label: "Tvoros aukstis",
      question: "Kokio aukscio segmentu noretumete?",
      subject: "fence",
      dimension: "height",
      units: ["m"],
      min: 0.8,
      max: 3,
    }),
    {
      ...requirement({
        id: "req_segmentine_gate_width",
        serviceId: "service_dev_segmentines_tvoros",
        requirementKey: "gate_width",
        label: "Vartu plotis",
        question: "Jei reikes vartu, koks planuojamas vartu plotis?",
        subject: "gate",
        dimension: "width",
        units: ["m"],
        min: 2,
        max: 8,
      }),
      required: false,
    },
  ],
  availabilityRules: [],
  locationZones: [
    {
      adminUnitCode: "vilniaus_r_sav",
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
      templateKey: "ask_missing_info",
      body: "Patikslinkite: {{questions}}",
      active: true,
    },
    {
      templateKey: "price_estimate",
      body: "Kaina: {{priceAmount}} {{currency}}. Terminas: {{leadTimeWeeks}}.",
      active: true,
    },
    {
      templateKey: "decline_location",
      body: "Sioje vietoveje nedirbame.",
      active: true,
    },
    {
      templateKey: "offering_answer",
      body: "{{offeringDescription}} {{offeringFollowup}}",
      active: true,
    },
  ],
};

function rulesWithSkardineFence(): ClientRules {
  return {
    ...rules,
    services: [
      ...rules.services,
      {
        id: "service_dev_skardines_tvoros",
        name: "DEV Skardines tvoros gamyba ir montavimas",
        label: "Skardines tvoros gamyba ir montavimas",
        keywords: ["skardine", "skardines", "skarda", "tvora", "tvoros"],
        offeringDescription:
          "Taip, gaminame ir montuojame skardines tvoras - vertikalias ir horizontalias.",
        active: true,
      },
    ],
    serviceSubjects: [
      ...(rules.serviceSubjects ?? []),
      {
        serviceId: "service_dev_skardines_tvoros",
        subjectKey: "fence",
        labelLt: "Tvora",
        descriptionLt: "skardine tvora, sklypo aptverimas",
        synonyms: ["tvora", "tvoros", "skarda", "skardine"],
      },
      {
        serviceId: "service_dev_skardines_tvoros",
        subjectKey: "gate",
        labelLt: "Vartai",
        descriptionLt: "ivaziavimo vartai automobiliui",
        synonyms: ["vartai", "vartu", "vartus"],
      },
    ],
    pricingRules: [
      ...rules.pricingRules,
      {
        id: "price_skardine_per_m",
        serviceId: "service_dev_skardines_tvoros",
        name: "Skardine tvora pagal metra",
        priceMin: 20,
        priceMax: 20,
        unit: "EUR/m",
        conditions: null,
        exclusions: null,
        disclaimerText: null,
        autoSendAllowed: true,
        active: true,
        rule: {
          type: "per_unit",
          requirementKey: "fence_length",
          unit: "m",
          pricePerUnit: 20,
          currency: "EUR",
          requires: ["fence_length", "fence_height"],
        },
      },
    ],
    decisionRequirements: [
      ...rules.decisionRequirements,
      requirement({
        id: "req_skardine_fence_length",
        serviceId: "service_dev_skardines_tvoros",
        requirementKey: "fence_length",
        label: "Tvoros ilgis",
        question: "Kiek metru skardines tvoros reiketu?",
        subject: "fence",
        dimension: "length",
        units: ["m"],
        min: 1,
        max: 500,
      }),
      requirement({
        id: "req_skardine_fence_height",
        serviceId: "service_dev_skardines_tvoros",
        requirementKey: "fence_height",
        label: "Tvoros aukstis",
        question: "Kokio aukscio skardines tvoros noretumete?",
        subject: "fence",
        dimension: "height",
        units: ["m"],
        min: 0.8,
        max: 3,
      }),
    ],
  };
}
