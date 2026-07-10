import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runTestLeadPipeline } from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type { ClientRules, DecisionRequirement } from "../lib/rules/types";

// 12 realistiškų klientų užklausų scenarijų (žr. docs/ARCHITEKTURA.md §9).
// LLM atsakymai mock'inami — testuojama deterministinė pipeline elgsena su
// realistišku LLM elgesiu (įskaitant atvejus, kai LLM praleidžia intentus
// arba grąžina tik bendrinį evidence). Paslaugos čia tik fixture — visa
// logika konfigūruojama per ClientRules, ne per domeno kodą.

const llmEnv = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "test-model",
  LLM_FIRST_PARSE: "true",
};

describe("realistic inquiry cases", () => {
  it("case 1: clear inquiry gets a price, lead time and no extra questions", async () => {
    const result = await run(
      "Sveiki, domina segmentinė tvora aplink sklypą Vilniaus rajone, Avižieniuose. Reikėtų apie 85 metrus tvoros, aukštis 1,5 m. Norėčiau su montavimu, be vartų, tik vieni varteliai. Sklypas lygus, gruntas normalus, ne molis. Kokia būtų preliminari kaina ir kada galėtumėte atvykti?",
      "case_1_clear",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinė tvora",
        intents: {
          asksPrice: true,
          asksAvailability: true,
          isUrgent: false,
          primaryIntent: "requests_quote",
        },
        location: {
          raw: "Vilniaus rajone",
          adminUnitCode: null,
          confidence: 0.95,
          evidence: "Vilniaus rajone",
        },
        facts: [
          fenceFact("fence_length", "length", 85, "apie 85 metrus tvoros"),
          fenceFact("fence_height", "height", 1.5, "aukštis 1,5 m"),
          gateOptOutFact("be vartų"),
        ],
      }),
    );

    assert.equal(result.parsedLead.serviceId, "service_segmentine");
    assert.equal(result.parsedLead.location?.adminUnit.code, "vilniaus_r_sav");
    assert.equal(
      result.parsedLead.resolvedRequirements.fence_length?.value,
      85,
    );
    assert.equal(
      result.parsedLead.resolvedRequirements.fence_height?.value,
      1.5,
    );
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.deepEqual(result.decisionResult.questionsToAsk, []);
    assert.equal(result.decisionResult.priceEstimate?.amount, 850);
    assert.equal(result.draftText, "Kaina: 850 EUR. Terminas: 3-5 sav.");
    assert.deepEqual(result.composed?.autoSendBlockedBy, ["TEST_LEAD"]);
  });

  it("case 2: vague inquiry gets one short clarifying question, no invented price", async () => {
    const result = await run(
      "Laba diena, kiek kainuotų tvora namui? Reikia aplink kiemą, domina pigesnis variantas. Gal galite parašyti kainą?",
      "case_2_vague",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "tvora",
      }),
    );

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(result.decisionResult.reason, "SERVICE_AMBIGUOUS");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio tipo tvorą svarstote?",
    ]);
    assert.equal(result.decisionResult.priceEstimate, null);
    assert.equal(
      result.draftText,
      "Patikslinkite: Kokio tipo tvorą svarstote?",
    );
  });

  it("case 3: partial inquiry naming an unoffered type goes to manual review with a clear draft", async () => {
    const result = await run(
      "Sveiki, norėčiau tvoros Kaune. Galvoju apie metalinę horizontalią tvorą, apie 40 metrų. Reikėtų ir vartų automatikos. Kiek maždaug kainuotų?",
      "case_3_partial_unsupported",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "tvoros",
        location: {
          raw: "Kaune",
          adminUnitCode: null,
          confidence: 0.95,
          evidence: "Kaune",
        },
      }),
    );

    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "unsupported_specific_service",
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.equal(result.decisionResult.priceEstimate, null);
    assert.equal(
      result.draftText,
      "Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „metalinę horizontalią tvorą“. Šiuo metu tokios paslaugos neteikiame.",
    );
  });

  it("case 4: urgent inquiry gets a priced draft with lead time but is blocked for human review", async () => {
    const result = await run(
      "Sveiki, ar galėtumėte įrengti tvorą dar šį mėnesį? Objektas Trakuose, reikia apie 60 m segmentinės tvoros, 1,7 m aukščio, su stulpais ir montavimu. Vartai nereikalingi. Labai svarbu terminas, nes atsikraustom su šunimi.",
      "case_4_urgent",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinės tvoros",
        facts: [
          fenceFact(
            "fence_length",
            "length",
            60,
            "apie 60 m segmentinės tvoros",
          ),
          fenceFact("fence_height", "height", 1.7, "1,7 m aukščio"),
          gateOptOutFact("Vartai nereikalingi"),
        ],
      }),
    );

    assert.equal(result.parsedLead.isUrgent, true);
    assert.equal(result.parsedLead.asksAvailability, true);
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.leadTime?.text, "3-5 sav.");
    assert.equal(result.draftText, "Kaina: 600 EUR. Terminas: 3-5 sav.");
    assert.equal(result.autoSendAllowed, false);
    assert.ok(result.composed?.autoSendBlockedBy.includes("URGENT"));
  });

  it("case 5: competitor price mention is flagged so a human decides, without auto promises", async () => {
    const result = await run(
      "Sveiki, gavau pasiūlymą segmentinei tvorai 72 m po 42 €/m su montavimu. Ar galėtumėte pasiūlyti geriau? Objektas Garliavoje, aukštis 1,5 m, spalva antracitas. Reikėtų dar vienų vartelių.",
      "case_5_competitor_price",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinei tvorai",
        facts: [
          fenceFact("fence_length", "length", 72, "72 m"),
          fenceFact("fence_height", "height", 1.5, "aukštis 1,5 m"),
        ],
      }),
    );

    assert.deepEqual(
      result.parsedLead.reviewSignals.map((signal) => [
        signal.type,
        signal.source,
      ]),
      [["competitor_price", "deterministic"]],
    );
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.priceEstimate?.amount, 720);
    assert.equal(result.autoSendAllowed, false);
    assert.ok(
      result.composed?.autoSendBlockedBy.includes(
        "REVIEW_SIGNAL:competitor_price",
      ),
    );
    assert.ok(result.draftText);
    assert.equal(result.draftText?.includes("pigiau"), false);
  });

  it("case 6: premium type outside the configured offering is not priced as the standard one", async () => {
    const result = await run(
      "Laba diena, domina moderni horizontali metalinė tvora prie naujos statybos namo. Bendras ilgis apie 55 metrai, aukštis apie 1,6 m. Norėtume juodos arba antracito spalvos, su stumdomais vartais ir varteliais. Objektas Vilniuje, Bajoruose. Gal galite pateikti preliminarų pasiūlymą?",
      "case_6_premium",
      llmResponse({ serviceId: null, serviceEvidence: null }),
    );

    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "unsupported_specific_service",
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.equal(result.decisionResult.priceEstimate, null);
    assert.equal(
      result.draftText,
      "Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „horizontali metalinė tvora“. Šiuo metu tokios paslaugos neteikiame.",
    );
  });

  it("case 7: on-site assessment request goes to manual review instead of a blind price", async () => {
    const result = await run(
      "Sveiki, reikia tvoros ant šlaito. Ilgis apie 35 m, aukščio norėtume 1,5–1,7 m. Nežinau, ar geriau segmentinė, ar skardinė / žaliuzi tipo. Reikėtų, kad kažkas atvažiuotų įvertinti vietoje. Objektas Nemenčinėje.",
      "case_7_site_visit",
      llmResponse({
        serviceId: null,
        serviceEvidence: null,
        reviewSignals: [
          {
            type: "site_visit_requested",
            evidence: "kad kažkas atvažiuotų įvertinti vietoje",
          },
        ],
      }),
    );

    assert.deepEqual(
      result.parsedLead.reviewSignals.map((signal) => [
        signal.type,
        signal.source,
      ]),
      [["site_visit_requested", "ai"]],
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "REVIEW_SIGNALS");
    assert.deepEqual(result.decisionResult.autoSendBlockedBy, [
      "REVIEW_SIGNAL:site_visit_requested",
    ]);
    assert.equal(result.decisionResult.priceEstimate, null);
    assert.equal(result.responseStatus, "manual_review");
  });

  it("case 8: unknown quantity asks for the exact missing parameters, no derived price", async () => {
    const result = await run(
      "Sveiki, domina tvora aplink sklypą. Sklypas 8 arai, namas jau pastatytas. Norėtume kažko paprasto ir ne per brangaus, gal segmentinės tvoros. Tikslaus ilgio nežinau. Ar galite paskaičiuoti pagal sklypo dydį?",
      "case_8_unknown_quantity",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinės tvoros",
        missingFields: ["fence_length", "fence_height"],
      }),
    );

    assert.equal(result.parsedLead.serviceId, "service_segmentine");
    assert.deepEqual(result.parsedLead.facts, []);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kiek metrų tvoros reikėtų?",
      "Kokio aukščio tvoros norėtumėte?",
    ]);
    assert.equal(result.decisionResult.priceEstimate, null);
    assert.equal(
      result.draftText,
      "Patikslinkite: Kiek metrų tvoros reikėtų? Kokio aukščio tvoros norėtumėte?",
    );
  });

  it("case 9: structured marketplace inquiry flows like free text and gets a price", async () => {
    const result = await run(
      "Reikalinga tvora privačiam namui.\nMiestas: Klaipėda\nTvoros tipas: segmentinė arba metalinė\nIlgis: apie 100 m\nAukštis: 1,5 m\nPapildomai: vartai ir varteliai\nTerminas: per 1–2 mėn.\nLauksiu kainos pasiūlymo.",
      "case_9_structured",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinė arba metalinė",
        intents: {
          asksPrice: true,
          asksAvailability: true,
          isUrgent: false,
          primaryIntent: "requests_quote",
        },
        location: {
          raw: "Klaipėda",
          adminUnitCode: null,
          confidence: 0.95,
          evidence: "Klaipėda",
        },
        facts: [
          fenceFact("fence_length", "length", 100, "apie 100 m"),
          fenceFact("fence_height", "height", 1.5, "1,5 m"),
        ],
      }),
    );

    assert.equal(result.parsedLead.location?.adminUnit.code, "klaipedos_m_sav");
    assert.equal(result.parsedLead.isUrgent, false);
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.priceEstimate?.amount, 1000);
    assert.equal(result.draftText, "Kaina: 1000 EUR. Terminas: 3-5 sav.");
  });

  it("case 10: unknown condition of an existing structure goes to manual review", async () => {
    const result = await run(
      "Sveiki, norime pakeisti seną tvorą. Yra senas pamatas, kai kur sutrūkinėjęs, stulpai seni metaliniai. Nežinome, ar galima naudoti esamą pagrindą, ar reikia viską griauti. Ilgis apie 45 m, norėtume gražesnės tvoros, gal horizontalios metalinės. Objektas Kaune. Kiek kainuotų?",
      "case_10_unknown_condition",
      llmResponse({
        serviceId: null,
        serviceEvidence: null,
        reviewSignals: [
          {
            type: "unknown_site_conditions",
            evidence:
              "Nežinome, ar galima naudoti esamą pagrindą, ar reikia viską griauti",
          },
        ],
      }),
    );

    assert.deepEqual(
      result.parsedLead.reviewSignals.map((signal) => signal.type),
      ["unknown_site_conditions"],
    );
    assert.equal(result.decisionResult.decision, "MANUAL_REVIEW");
    assert.equal(result.decisionResult.reason, "REVIEW_SIGNALS");
    assert.deepEqual(result.decisionResult.autoSendBlockedBy, [
      "REVIEW_SIGNAL:unknown_site_conditions",
    ]);
    assert.equal(result.decisionResult.priceEstimate, null);
  });

  it("case 11: partial service request is scoped to that service's requirements only", async () => {
    const result = await run(
      "Sveiki, domina tik stumdomi vartai su automatika. Angos plotis apie 4 m, tvora jau yra. Norėčiau antracito spalvos, metaliniai horizontalūs profiliai. Kokia būtų kaina su montavimu Vilniuje?",
      "case_11_partial_service",
      llmResponse({
        serviceId: "service_vartai",
        serviceEvidence: "stumdomi vartai",
        location: {
          raw: "Vilniuje",
          adminUnitCode: null,
          confidence: 0.95,
          evidence: "Vilniuje",
        },
        facts: [
          {
            requirementKey: "gate_width",
            kind: "measurement",
            subject: "gate",
            dimension: "width",
            value: 4,
            valueMin: null,
            valueMax: null,
            unit: "m",
            evidence: "apie 4 m",
            confidence: 0.95,
            negated: false,
          },
        ],
      }),
    );

    assert.equal(result.parsedLead.serviceId, "service_vartai");
    assert.equal(result.parsedLead.resolvedRequirements.gate_width?.value, 4);
    assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(result.decisionResult.priceEstimate?.amount, 2000);
    // Tvoros klausimai neklausiami — requirements ribojami pasirinkta paslauga.
    assert.deepEqual(result.decisionResult.questionsToAsk, []);
    assert.equal(result.draftText, "Kaina: 2000 EUR.");
  });

  it("case 12: short social message gets one short question back", async () => {
    const result = await run(
      "Sveiki, tvoras darot? Kiek kainuoja metras?",
      "case_12_social",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "tvoras",
      }),
    );

    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio tipo tvorą svarstote?",
    ]);
    assert.equal(
      result.draftText,
      "Patikslinkite: Kokio tipo tvorą svarstote?",
    );
  });

  it("rejects an LLM review signal whose evidence is not verbatim in the text", async () => {
    const result = await run(
      "Sveiki, domina segmentinė tvora, apie 30 m. Kiek kainuotų?",
      "case_signal_rejected",
      llmResponse({
        serviceId: "service_segmentine",
        serviceEvidence: "segmentinė tvora",
        reviewSignals: [
          {
            type: "site_visit_requested",
            evidence: "klientas prašo apžiūros vietoje",
          },
        ],
        facts: [fenceFact("fence_length", "length", 30, "apie 30 m")],
      }),
    );

    assert.deepEqual(result.parsedLead.reviewSignals, []);
    const rejectedFindings = (
      result.trace.stages[0]?.data as {
        rejectedFindings: Array<{ type: string; reason: string }>;
      }
    ).rejectedFindings;
    assert.ok(
      rejectedFindings.some(
        (finding) =>
          finding.type === "review_signal" &&
          finding.reason === "REVIEW_SIGNAL_EVIDENCE_NOT_FOUND",
      ),
    );
    // Signalas atmestas — sprendimas nesikeičia (klausiama trūkstamo aukščio).
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
  });
});

async function run(
  inquiryMessage: string,
  leadId: string,
  mockedResponse: string,
) {
  return runTestLeadPipeline({
    input: { ...baseInput(), inquiryMessage },
    rules,
    leadId,
    isTest: true,
    aiOptions: {
      env: llmEnv,
      callModel: async () => mockedResponse,
    },
  });
}

function baseInput(): TestInquiryInput {
  return {
    serviceId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    city: "",
    inquiryMessage: "",
    asksPrice: false,
    asksAvailability: false,
    isUrgent: false,
  };
}

function llmResponse(overrides: Record<string, unknown>): string {
  return JSON.stringify({
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
    reviewSignals: [],
    missingFields: [],
    ...overrides,
  });
}

function fenceFact(
  requirementKey: "fence_length" | "fence_height",
  dimension: "length" | "height",
  value: number,
  evidence: string,
) {
  return {
    requirementKey,
    kind: "measurement",
    subject: "fence",
    dimension,
    value,
    valueMin: null,
    valueMax: null,
    unit: "m",
    evidence,
    confidence: 0.95,
    negated: false,
  };
}

function gateOptOutFact(evidence: string) {
  return {
    requirementKey: "gate_width",
    kind: "selection",
    subject: "gate",
    dimension: null,
    value: false,
    valueMin: null,
    valueMax: null,
    unit: null,
    evidence,
    confidence: 0.95,
    negated: true,
  };
}

function requirement(params: {
  id: string;
  serviceId: string;
  requirementKey: string;
  label: string;
  question: string;
  subject: string;
  dimension: "length" | "width" | "height";
  min: number;
  max: number;
  required?: boolean;
  priority?: number;
}): DecisionRequirement {
  return {
    id: params.id,
    serviceId: params.serviceId,
    requirementKey: params.requirementKey,
    label: params.label,
    requiredFor: "auto_send",
    questionTextIfMissing: params.question,
    blocksAutoSend: true,
    priority: params.priority ?? 10,
    active: true,
    required: params.required ?? true,
    affectsPrice: true,
    expectedFact: {
      kind: "measurement",
      subject: params.subject,
      dimension: params.dimension,
      units: ["m"],
    },
    validation: { min: params.min, max: params.max },
  };
}

const rules: ClientRules = {
  services: [
    {
      id: "service_segmentine",
      name: "Segmentinės tvoros montavimas",
      label: "Segmentinės tvoros montavimas",
      keywords: ["segmentinė", "segmentinės", "tvora", "tvoros"],
      active: true,
    },
    {
      id: "service_vartai",
      name: "Stumdomi ir varstomi vartai",
      label: "Stumdomi ir varstomi vartai",
      keywords: ["vartai", "vartų", "vartus", "varteliai", "stumdomi"],
      active: true,
    },
  ],
  serviceSubjects: [
    {
      serviceId: "service_segmentine",
      subjectKey: "fence",
      labelLt: "Tvora",
      descriptionLt: "tvora, sklypo aptvėrimas segmentais",
      synonyms: ["tvora", "tvoros", "segmentinė"],
    },
    {
      serviceId: "service_segmentine",
      subjectKey: "gate",
      labelLt: "Vartai",
      descriptionLt: "įvažiavimo vartai",
      synonyms: ["vartai", "vartų", "vartus"],
    },
    {
      serviceId: "service_vartai",
      subjectKey: "gate",
      labelLt: "Vartai",
      descriptionLt: "įvažiavimo vartai automobiliui",
      synonyms: ["vartai", "stumdomi vartai"],
    },
  ],
  pricingRules: [
    {
      id: "price_segmentine_per_m",
      serviceId: "service_segmentine",
      name: "Segmentinė tvora pagal metrą",
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
    {
      id: "price_vartai_per_m",
      serviceId: "service_vartai",
      name: "Vartai pagal angos plotį",
      priceMin: 500,
      priceMax: 500,
      unit: "EUR/m",
      conditions: null,
      exclusions: null,
      disclaimerText: null,
      autoSendAllowed: true,
      active: true,
      rule: {
        type: "per_unit",
        requirementKey: "gate_width",
        unit: "m",
        pricePerUnit: 500,
        currency: "EUR",
        requires: ["gate_width"],
      },
    },
  ],
  decisionRequirements: [
    requirement({
      id: "req_fence_length",
      serviceId: "service_segmentine",
      requirementKey: "fence_length",
      label: "Tvoros ilgis",
      question: "Kiek metrų tvoros reikėtų?",
      subject: "fence",
      dimension: "length",
      min: 1,
      max: 500,
      priority: 10,
    }),
    requirement({
      id: "req_fence_height",
      serviceId: "service_segmentine",
      requirementKey: "fence_height",
      label: "Tvoros aukštis",
      question: "Kokio aukščio tvoros norėtumėte?",
      subject: "fence",
      dimension: "height",
      min: 0.8,
      max: 3,
      priority: 20,
    }),
    requirement({
      id: "req_segmentine_gate_width",
      serviceId: "service_segmentine",
      requirementKey: "gate_width",
      label: "Vartų plotis",
      question: "Jei reikės vartų, koks angos plotis?",
      subject: "gate",
      dimension: "width",
      min: 2,
      max: 8,
      required: false,
      priority: 30,
    }),
    requirement({
      id: "req_vartai_gate_width",
      serviceId: "service_vartai",
      requirementKey: "gate_width",
      label: "Vartų angos plotis",
      question: "Koks vartų angos plotis metrais?",
      subject: "gate",
      dimension: "width",
      min: 2,
      max: 8,
      priority: 10,
    }),
  ],
  availabilityRules: [],
  locationZones: [
    {
      adminUnitCode: "vilniaus_m_sav",
      zone: "zone_a",
      travelFeeEur: 0,
      served: true,
    },
    {
      adminUnitCode: "vilniaus_r_sav",
      zone: "zone_a",
      travelFeeEur: 0,
      served: true,
    },
    {
      adminUnitCode: "kauno_m_sav",
      zone: "zone_b",
      travelFeeEur: 0,
      served: true,
    },
    {
      adminUnitCode: "klaipedos_m_sav",
      zone: "zone_b",
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
      body: "Šioje vietovėje nedirbame.",
      active: true,
    },
    {
      templateKey: "offering_answer",
      body: "{{offeringDescription}} {{offeringFollowup}}",
      active: true,
    },
  ],
};
