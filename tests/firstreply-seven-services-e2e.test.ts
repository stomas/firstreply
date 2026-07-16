import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  runDeterministicLeadPipelineForTests,
  runTestLeadPipeline,
} from "../lib/leads/test-pipeline";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";
import type {
  ClientRules,
  DecisionRequirement,
  PricingRule,
} from "../lib/rules/types";

const SERVICE = {
  barrier: "service_barrier",
  gates: "service_gates",
  posts: "service_posts",
  domophone: "service_domophone",
  canopy: "service_canopy",
  fence: "service_fence",
  automation: "service_automation",
} as const;

const rules: ClientRules = {
  services: [
    service(SERVICE.barrier, "Kelio užtvarai (šlagbaumai)", [
      "šlagbaumas",
      "šlagbaumai",
      "kelio užtvaras",
      "parkingo užtvaras",
      "barjeras",
    ]),
    service(SERVICE.gates, "Kiemo vartai ir varteliai", [
      "vartai",
      "varteliai",
      "kiemo vartai",
      "stumdomi vartai",
      "slankiojantys vartai",
      "varstomi vartai",
    ]),
    service(SERVICE.posts, "Multifunkciniai stulpai", [
      "stulpai",
      "multifunkciniai stulpai",
      "kiemo stulpas",
      "pašto dėžutės stulpas",
      "domofono stulpas",
    ]),
    service(SERVICE.domophone, "Praėjimo kontrolė (domofonai)", [
      "domofonas",
      "domofonai",
      "telefonspynė",
      "praėjimo kontrolė",
    ]),
    service(SERVICE.canopy, "Stoginės", [
      "stoginė",
      "stoginės",
      "automobilių stoginė",
      "carportas",
      "carport",
    ]),
    service(SERVICE.fence, "Tvoros", [
      "tvora",
      "tvoros",
      "segmentinė",
      "metalinė",
    ]),
    service(SERVICE.automation, "Vartų automatika", [
      "automatika",
      "vartų automatika",
      "vartų variklis",
      "variklis",
      "pultelis",
    ]),
  ],
  serviceSubjects: [
    subject(SERVICE.barrier, "automatinis_slagbaumas", [
      "šlagbaumas",
      "parkingo užtvaras",
    ]),
    subject(SERVICE.gates, "stumdomi_vartai", [
      "stumdomi vartai",
      "slankiojantys vartai",
    ]),
    subject(SERVICE.posts, "multifunkcinis_stulpas", [
      "multifunkcinis stulpas",
      "kiemo stulpas",
    ]),
    subject(SERVICE.domophone, "vaizdo_domofonas", [
      "domofonas",
      "telefonspynė",
    ]),
    subject(SERVICE.canopy, "automobilio_stogine", [
      "automobilio stoginė",
      "carportas",
    ]),
    subject(SERVICE.fence, "segmentine_tvora", ["tvora", "segmentinė"]),
    subject(SERVICE.automation, "vartu_automatika", [
      "vartų automatika",
      "vartų variklis",
      "pultelis vartams",
    ]),
  ],
  decisionRequirements: [
    measurementRequirement({
      serviceId: SERVICE.barrier,
      key: "barrier_width",
      label: "Užtvaro ilgis",
      question: "Kokio ilgio užtvaros reikia (metrais)?",
      subject: "automatinis_slagbaumas",
      dimension: "width",
      units: ["m"],
      min: 2,
      max: 8,
    }),
    measurementRequirement({
      serviceId: SERVICE.gates,
      key: "gate_width",
      label: "Vartų plotis",
      question: "Kokio pločio važiuojamiems vartams reikia (metrais)?",
      subject: null,
      dimension: "width",
      units: ["m"],
      min: 2,
      max: 8,
    }),
    measurementRequirement({
      serviceId: SERVICE.posts,
      key: "post_height",
      label: "Stulpo aukštis",
      question: "Kokio aukščio stulpo reikia (metrais)?",
      subject: "multifunkcinis_stulpas",
      dimension: "height",
      units: ["m"],
      min: 1.2,
      max: 2.2,
    }),
    measurementRequirement({
      serviceId: SERVICE.domophone,
      key: "domophone_entrances",
      label: "Aptarnaujamų įėjimų skaičius",
      question: "Kiek įėjimų arba vartelių turi aptarnauti sistema?",
      subject: "vaizdo_domofonas",
      dimension: "length",
      units: ["vnt."],
      min: 1,
      max: 4,
    }),
    measurementRequirement({
      serviceId: SERVICE.canopy,
      key: "canopy_area",
      label: "Stoginės plotas",
      question: "Koks numatomas stoginės plotas (m²)?",
      subject: "automobilio_stogine",
      dimension: "area",
      units: ["m²"],
      min: 10,
      max: 80,
    }),
    measurementRequirement({
      serviceId: SERVICE.fence,
      key: "fence_height",
      label: "Tvoros aukštis",
      question: "Kokio aukščio tvoros pageidaujate (metrais)?",
      subject: null,
      dimension: "height",
      units: ["m"],
      min: 0.5,
      max: 2.5,
      priority: 10,
    }),
    measurementRequirement({
      serviceId: SERVICE.fence,
      key: "fence_length",
      label: "Tvoros ilgis",
      question: "Kiek metrų tvoros planuojate?",
      subject: null,
      dimension: "length",
      units: ["m"],
      min: 1,
      max: 500,
      priority: 20,
    }),
    measurementRequirement({
      serviceId: SERVICE.automation,
      key: "automation_gate_width",
      label: "Vartų plotis",
      question: "Kokio pločio vartams reikalinga automatika (metrais)?",
      subject: "vartu_automatika",
      dimension: "width",
      units: ["m"],
      min: 2,
      max: 8,
    }),
  ],
  pricingRules: [
    rangeRule(SERVICE.barrier, "barrier_width", 950, 1800, "už vnt."),
    rangeRule(SERVICE.gates, "gate_width", 1700, 3500, "už komplektą"),
    rangeRule(SERVICE.posts, "post_height", 450, 1100, "už vnt."),
    rangeRule(
      SERVICE.domophone,
      "domophone_entrances",
      380,
      1200,
      "už sistemą",
      "vnt.",
    ),
    rangeRule(SERVICE.canopy, "canopy_area", 3500, 11000, "už projektą", "m²"),
    {
      ...pricingBase(SERVICE.fence, "Tvora pagal ilgį", 45, 120, "€/m"),
      autoSendAllowed: true,
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        currency: "EUR",
        pricePerUnit: 55,
        requires: ["fence_length", "fence_height"],
        modifiers: [
          {
            if: { requirementKey: "fence_height", gte: 1.8 },
            pricePerUnitDelta: 12,
          },
        ],
      },
    },
    rangeRule(
      SERVICE.automation,
      "automation_gate_width",
      650,
      1600,
      "už komplektą",
    ),
  ],
  availabilityRules: [],
  locationZones: [],
  scheduleRules: [],
  autosendPolicies: [{ policy: { enabled: true } }],
  responseTemplates: [
    {
      templateKey: "ask_missing_info",
      body: "Sveiki, ačiū už užklausą. Kad galėtume pateikti tikslesnį atsakymą, patikslinkite: {{questions}}",
      active: true,
    },
    {
      templateKey: "price_estimate",
      body: "Sveiki, ačiū už užklausą. Orientacinė kaina pagal pateiktą informaciją: {{priceAmount}} {{currency}}. Preliminarus terminas: {{leadTimeWeeks}}.",
      active: true,
    },
  ],
};

describe("FirstReply seven-service E2E regressions", () => {
  it("1. šlagbaumas 5 m → kainos intervalas", async () => {
    const result = await run("Reikia šlagbaumo 5 m, kokia kaina?");
    assertOutcome(result, SERVICE.barrier, "950–1800 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.barrier_width?.value,
      5,
    );
  });

  it("2. parkingo užtvara 2 m → minimali riba ir kainos intervalas", async () => {
    const result = await run("Reikia parkingo užtvaros 2 m, kiek kainuos?");
    assertOutcome(result, SERVICE.barrier, "950–1800 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.barrier_width?.value,
      2,
    );
  });

  it("3. slankiojantys vartai 5,5 m → kiemo vartai", async () => {
    const result = await run(
      "Reikia slankiojančių vartų, plotis 5,5 m. Kokia kaina?",
    );
    assertOutcome(result, SERVICE.gates, "1700–3500 EUR");
    assert.equal(result.parsedLead.resolvedRequirements.gate_width?.value, 5.5);
  });

  it("4. vartai be pločio → vienas neutralus pločio klausimas", async () => {
    const result = await run("Reikia kiemo vartų. Kokia kaina?");
    assert.equal(result.parsedLead.serviceId, SERVICE.gates);
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio pločio važiuojamiems vartams reikia (metrais)?",
    ]);
    assert.equal(result.draftText?.includes("automatika"), false);
  });

  it("5. stulpas 1,7 m → galiojanti reikšmė", async () => {
    const result = await run(
      "Reikia multifunkcinio stulpo 1,7 m aukščio, kokia kaina?",
    );
    assertOutcome(result, SERVICE.posts, "450–1100 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.post_height?.value,
      1.7,
    );
  });

  it("6. stulpas 1 m → aiškus validacijos patikslinimas", async () => {
    const result = await run(
      "Reikia multifunkcinio stulpo 1 m aukščio, kokia kaina?",
    );
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(result.decisionResult.reason, "VALIDATION_FAILED");
    assert.match(result.draftText ?? "", /1,2–2,2 m/u);
    assert.equal(result.decisionResult.priceEstimate, null);
  });

  it("7. domofonas dviem varteliams → 2 įėjimai", async () => {
    const result = await run("Reikia domofono dviem varteliams, kokia kaina?");
    assertOutcome(result, SERVICE.domophone, "380–1200 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.domophone_entrances?.value,
      2,
    );
  });

  it("8. telefonspynė keturiems įėjimams → 4 įėjimai", async () => {
    const result = await run(
      "Reikia telefonspynės keturiems įėjimams, kokia kaina?",
    );
    assertOutcome(result, SERVICE.domophone, "380–1200 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.domophone_entrances?.value,
      4,
    );
  });

  it("9. carportas 32 m² → stoginė", async () => {
    const result = await run("Reikia carporto 32 kv. m, kokia kaina?");
    assertOutcome(result, SERVICE.canopy, "3500–11000 EUR");
    assert.equal(result.parsedLead.resolvedRequirements.canopy_area?.value, 32);
  });

  it("10. stoginė 120 m² → patikslinimas, be kainos", async () => {
    const result = await run("Reikia stoginės 120 kvadratų, kokia kaina?");
    assert.equal(result.decisionResult.decision, "ASK_MISSING_INFO");
    assert.equal(result.decisionResult.reason, "VALIDATION_FAILED");
    assert.equal(
      result.decisionResult.questionsToAsk[0],
      "Nurodytas 120 m² plotas viršija įprastą 10–80 m² ribą. Ar galite patikslinti planuojamą plotą?",
    );
    assert.equal(result.decisionResult.priceEstimate, null);
  });

  it("11. tvora 38 m × 1,7 m → 2 090 EUR", async () => {
    const result = await run("Reikia tvoros 38 m, aukštis 1,7 m. Kokia kaina?");
    assertOutcome(result, SERVICE.fence, "2090 EUR");
    assert.equal(result.decisionResult.priceEstimate?.amount, 2090);
  });

  it("12. tvora be matmenų → aukščio ir ilgio klausimai", async () => {
    const result = await run("Reikia tvoros, kokia kaina?");
    assert.equal(result.parsedLead.serviceId, SERVICE.fence);
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Kokio aukščio tvoros pageidaujate (metrais)?",
      "Kiek metrų tvoros planuojate?",
    ]);
  });

  it("13. vartų variklis 4,2 m → automatika", async () => {
    const result = await run(
      "Reikia vartų variklio 4,2 m pločio vartams, kokia kaina?",
    );
    assertOutcome(result, SERVICE.automation, "650–1600 EUR");
    assert.equal(
      result.parsedLead.resolvedRequirements.automation_gate_width?.value,
      4.2,
    );
  });

  it("14. automatika + nauji vartai → apimties pasirinkimo klausimas", async () => {
    const result = await run("Reikia automatikos ir naujų vartų.", false);
    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(
      result.parsedLead.serviceClassification?.reason,
      "multiple_services",
    );
    assert.deepEqual(result.decisionResult.questionsToAsk, [
      "Ar reikia naujų vartų, automatikos esamiems vartams, ar abiejų sprendimų?",
    ]);
  });

  it("15. saulės elektrinė → mandagus unsupported atsakymas be kainos", async () => {
    const result = await run(
      "Ar montuojate saulės elektrines ant stogo?",
      false,
    );
    assert.equal(result.parsedLead.serviceId, null);
    assert.equal(result.decisionResult.reason, "SERVICE_UNSUPPORTED");
    assert.equal(
      result.draftText,
      "Šiuo metu saulės elektrinių montavimo paslaugos neteikiame.",
    );
    assert.equal(result.decisionResult.priceEstimate, null);
  });
});

describe("seven-service recognition inflections and safe offering fallback", () => {
  for (const variant of ["slankiojantys vartai", "slankiojančius vartus"]) {
    it(`recognizes gate variant: ${variant}`, async () => {
      const result = await run(`${variant}, plotis 5 m, kokia kaina?`);
      assert.equal(result.parsedLead.serviceId, SERVICE.gates);
    });
  }

  for (const variant of [
    "multifunkcinis stulpas",
    "multifunkcinio stulpo",
    "kiemo stulpas pašto dėžutei ir domofonui",
  ]) {
    it(`recognizes post variant: ${variant}`, async () => {
      const result = await run(`${variant}, aukštis 1,7 m, kokia kaina?`);
      assert.equal(result.parsedLead.serviceId, SERVICE.posts);
    });
  }

  it("answers an offering question without DB offering fields or template", async () => {
    const result = await run("Ar montuojate šlagbaumus?", false);
    assert.equal(result.decisionResult.decision, "OFFERING_ANSWER");
    assert.equal(result.decisionResult.reason, "OFFERING_SAFE_FALLBACK");
    assert.match(result.draftText ?? "", /Taip, šią paslaugą teikiame/u);
    assert.match(result.draftText ?? "", /Kokio ilgio užtvaros reikia/u);
  });

  it("adds a range to an offering answer when requirements are complete", async () => {
    const result = await run("Ar montuojate šlagbaumus 5 m?", false);
    assert.equal(result.decisionResult.decision, "OFFERING_ANSWER");
    assert.match(result.draftText ?? "", /950–1800 EUR/u);
  });

  it("keeps TEST_LEAD as the final auto-send safety blocker", async () => {
    const result = await run("Reikia tvoros 38 m, aukštis 1,7 m. Kokia kaina?");
    assert.equal(result.autoSendAllowed, false);
    assert.ok(result.composed?.autoSendBlockedBy.includes("TEST_LEAD"));
  });

  it("keeps deterministic quantities when LLM-first omits dviem/keturiems", async () => {
    const two = await runLlmFirst(
      "Reikia domofono dviem varteliams, kokia kaina?",
      SERVICE.domophone,
      "domofono",
    );
    const four = await runLlmFirst(
      "Reikia telefonspynės keturiems įėjimams, kokia kaina?",
      SERVICE.domophone,
      "telefonspynės",
    );

    assert.equal(
      two.parsedLead.resolvedRequirements.domophone_entrances?.value,
      2,
    );
    assert.equal(
      four.parsedLead.resolvedRequirements.domophone_entrances?.value,
      4,
    );
    assert.equal(two.decisionResult.decision, "PRICE_ESTIMATE");
    assert.equal(four.decisionResult.decision, "PRICE_ESTIMATE");
  });

  it("keeps deterministic decimal and area facts when LLM-first omits them", async () => {
    const gates = await runLlmFirst(
      "Reikia slankiojančių vartų 5,5 m pločio, kokia kaina?",
      SERVICE.gates,
      "slankiojančių vartų",
    );
    const canopy = await runLlmFirst(
      "Reikia carporto 32 kv. m, kokia kaina?",
      SERVICE.canopy,
      "carporto",
    );

    assert.equal(gates.parsedLead.resolvedRequirements.gate_width?.value, 5.5);
    assert.equal(canopy.parsedLead.resolvedRequirements.canopy_area?.value, 32);
  });
});

async function run(message: string, asksPrice = true) {
  const input: TestInquiryInput = {
    serviceId: "",
    inquiryMessage: message,
    city: "",
    asksPrice,
    asksAvailability: false,
    isUrgent: false,
  };

  return runDeterministicLeadPipelineForTests({
    input,
    rules,
    leadId: `e2e_${message}`,
    isTest: true,
    aiOptions: {
      env: { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" },
      callModel: async () =>
        JSON.stringify({
          bindings: [],
          newFacts: [],
          conflicts: [],
          serviceClassification: null,
          primaryIntent: null,
        }),
    },
  });
}

async function runLlmFirst(
  message: string,
  serviceId: string,
  serviceEvidence: string,
) {
  return runTestLeadPipeline({
    input: {
      serviceId: "",
      inquiryMessage: message,
      city: "",
      asksPrice: true,
      asksAvailability: false,
      isUrgent: false,
    },
    rules,
    leadId: `llm_first_${serviceId}`,
    isTest: true,
    aiOptions: {
      env: {
        OPENAI_API_KEY: "test",
        OPENAI_MODEL: "test",
      },
      callModel: async () =>
        JSON.stringify({
          schemaVersion: "lead_parse_v3_llm_first",
          serviceId,
          serviceEvidence,
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
        }),
    },
  });
}

function assertOutcome(
  result: Awaited<ReturnType<typeof run>>,
  serviceId: string,
  priceText: string,
) {
  assert.equal(result.parsedLead.serviceId, serviceId);
  assert.equal(result.decisionResult.decision, "PRICE_ESTIMATE");
  assert.equal(result.decisionResult.reason, "PRICE_RULE_MATCHED");
  assert.match(result.draftText ?? "", new RegExp(priceText, "u"));
  assert.equal(result.autoSendAllowed, false);
  assert.ok(result.composed?.autoSendBlockedBy.includes("TEST_LEAD"));
}

function service(id: string, label: string, keywords: string[]) {
  return { id, name: label, label, keywords, active: true };
}

function subject(serviceId: string, subjectKey: string, synonyms: string[]) {
  return {
    serviceId,
    subjectKey,
    labelLt: synonyms[0],
    descriptionLt: synonyms.join(", "),
    synonyms,
  };
}

function measurementRequirement(params: {
  serviceId: string;
  key: string;
  label: string;
  question: string;
  subject: string | null;
  dimension: "length" | "height" | "width" | "area";
  units: string[];
  min: number;
  max: number;
  priority?: number;
}): DecisionRequirement {
  return {
    id: `req_${params.key}`,
    serviceId: params.serviceId,
    requirementKey: params.key,
    label: params.label,
    requiredFor: "auto_send",
    questionTextIfMissing: params.question,
    blocksAutoSend: true,
    priority: params.priority ?? 10,
    active: true,
    required: true,
    affectsPrice: true,
    expectedFact: {
      kind: "measurement",
      ...(params.subject ? { subject: params.subject } : {}),
      dimension: params.dimension,
      units: params.units,
    },
    validation: { min: params.min, max: params.max },
  };
}

function pricingBase(
  serviceId: string,
  name: string,
  priceMin: number,
  priceMax: number,
  unit: string,
): PricingRule {
  return {
    id: `price_${serviceId}`,
    serviceId,
    name,
    priceMin,
    priceMax,
    unit,
    conditions: null,
    exclusions: null,
    disclaimerText: null,
    autoSendAllowed: false,
    active: true,
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
  };
}

function rangeRule(
  serviceId: string,
  requirementKey: string,
  priceMin: number,
  priceMax: number,
  displayUnit: string,
  requirementUnit = "m",
): PricingRule {
  return {
    ...pricingBase(
      serviceId,
      `${serviceId} intervalas`,
      priceMin,
      priceMax,
      displayUnit,
    ),
    rule: {
      type: "range_estimate",
      requirementKey,
      unit: requirementUnit,
      currency: "EUR",
      requires: [requirementKey],
    },
  };
}
