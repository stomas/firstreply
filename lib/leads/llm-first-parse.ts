import { z } from "zod";
import {
  AI_NOT_CONFIGURED,
  callOpenAiResponsesApi,
  isAiConfigured,
  normalizeRangeFactValue,
  stripJsonFence,
  type AiEnvironment,
  type AiModelCaller,
  type AiModelRequest,
} from "@/lib/ai/openai-client";
import { resolveLocationText } from "@/lib/extractor/deterministic";
import type {
  AdminUnitLocation,
  ExtractedContacts,
  ExtractedFact,
  ExtractedUnit,
  FactKind,
  MeasurementDimension,
  PrimaryIntent,
} from "@/lib/extractor/types";
import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import type { ParsedLeadData } from "@/lib/leads/parse-lead";
import type { ServiceClassification } from "@/lib/leads/service-classifier";
import {
  serviceEvidenceIsSpecific,
  findUnsupportedOfferingEvidence,
  serviceEvidenceNamesSpecificOffering,
} from "@/lib/leads/service-specificity";
import {
  asRecord,
  factMatchesExpectedFact,
} from "@/lib/requirements/fact-validation";
import type {
  ClientRules,
  DecisionRequirement,
  RuleJson,
  ServiceRule,
  ServiceSubjectRule,
} from "@/lib/rules/types";
import { verifyAiEvidence } from "@/lib/verifier/evidence";

export const LLM_FIRST_PARSE_VERSION = "lead_parse_v3_llm_first";
const DEFAULT_VERIFIED_LLM_CONFIDENCE = 0.9;

export type LlmFirstParseRejectReason =
  | "SERVICE_NOT_IN_LIST"
  | "SERVICE_EVIDENCE_NOT_FOUND"
  | "SERVICE_EVIDENCE_NOT_SPECIFIC"
  | "SERVICE_VALUE_NOT_IN_EVIDENCE"
  | "NO_SERVICE"
  | "REQUIREMENT_NOT_ALLOWED"
  | "EXPECTED_FACT_UNSUPPORTED"
  | "EXPECTED_FACT_MISMATCH"
  | "SUBJECT_NOT_ALLOWED"
  | "NO_VALUE"
  | "EVIDENCE_NOT_FOUND"
  | "VALUE_NOT_IN_EVIDENCE"
  | "LOCATION_EVIDENCE_NOT_FOUND"
  | "LOCATION_VALUE_NOT_IN_EVIDENCE";

export type LlmFirstRejectedFinding = {
  type: "service" | "fact" | "location";
  target: string;
  reason: LlmFirstParseRejectReason;
};

export type LlmFirstParseResult =
  | {
      status: "ok";
      parsed: ParsedLeadData;
      rawResponses: string[];
      rejectedFindings: LlmFirstRejectedFinding[];
      rawParse: LlmFirstResponse;
    }
  | {
      status: "manual_review";
      reason: typeof AI_NOT_CONFIGURED | "AI_PARSE_FAILED";
      parsed: ParsedLeadData;
      rawResponses: string[];
    };

type ParseTestInquiryLeadLlmFirstInput = {
  input: TestInquiryInput;
  rules: ClientRules;
};

const primaryIntentSchema = z
  .enum([
    "requests_quote",
    "asks_offering",
    "asks_availability",
    "asks_process",
    "provides_info",
    "other",
  ])
  .nullable();

const llmFactSchema = z.preprocess(
  normalizeRangeFactValue,
  z.object({
    requirementKey: z.string(),
    kind: z.string(),
    subject: z.string().nullable().optional(),
    dimension: z.string().nullable().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
    valueMin: z.number().nullable().optional(),
    valueMax: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    evidence: z.string().min(1),
    confidence: z.number().min(0).max(1),
    negated: z.boolean().default(false),
  }),
);

const llmLocationSchema = z
  .object({
    raw: z.string().nullable(),
    adminUnitCode: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).default(0),
    evidence: z.string().nullable().optional(),
  })
  .nullable();

const llmFirstResponseSchema = z
  .object({
    schemaVersion: z.literal(LLM_FIRST_PARSE_VERSION),
    serviceId: z.string().nullable(),
    serviceEvidence: z.string().nullable().optional(),
    intents: z
      .object({
        asksPrice: z.boolean().default(false),
        asksAvailability: z.boolean().default(false),
        isUrgent: z.boolean().default(false),
        primaryIntent: primaryIntentSchema.default(null),
      })
      .default({
        asksPrice: false,
        asksAvailability: false,
        isUrgent: false,
        primaryIntent: null,
      }),
    location: llmLocationSchema.default(null),
    facts: z.array(llmFactSchema).default([]),
    missingFields: z.array(z.string()).default([]),
  })
  .passthrough();

export type LlmFirstResponse = z.infer<typeof llmFirstResponseSchema>;
type LlmFirstFact = z.infer<typeof llmFactSchema>;

export function isLlmFirstParseEnabled(
  env: AiEnvironment = process.env,
): boolean {
  return env.LLM_FIRST_PARSE === "true";
}

export async function parseTestInquiryLeadLlmFirst(
  { input, rules }: ParseTestInquiryLeadLlmFirstInput,
  options: {
    env?: AiEnvironment;
    callModel?: AiModelCaller;
  } = {},
): Promise<LlmFirstParseResult> {
  const env = options.env ?? process.env;
  const fallbackParsed = emptyParsedLead(input, rules);

  if (!isAiConfigured(env)) {
    return {
      status: "manual_review",
      reason: AI_NOT_CONFIGURED,
      parsed: fallbackParsed,
      rawResponses: [],
    };
  }

  const request = buildLlmFirstRequest({ input, rules }, env);
  const callModel = options.callModel ?? callOpenAiResponsesApi;
  const rawResponses: string[] = [];
  let parsedResponse: LlmFirstResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawResponse = await callModel(request);
    rawResponses.push(rawResponse);
    parsedResponse = parseLlmFirstResponse(rawResponse);
    if (parsedResponse) {
      break;
    }
  }

  if (!parsedResponse) {
    return {
      status: "manual_review",
      reason: "AI_PARSE_FAILED",
      parsed: fallbackParsed,
      rawResponses,
    };
  }

  const applied = applyLlmFirstResponse({
    input,
    rules,
    response: parsedResponse,
  });

  return {
    status: "ok",
    parsed: applied.parsed,
    rawResponses,
    rejectedFindings: applied.rejectedFindings,
    rawParse: parsedResponse,
  };
}

function buildLlmFirstRequest(
  { input, rules }: ParseTestInquiryLeadLlmFirstInput,
  env: AiEnvironment,
): AiModelRequest {
  return {
    model: env.OPENAI_MODEL?.trim() ?? "",
    system:
      "Tu esi LLM-first lead faktų ekstraktorius. Grąžink TIK validų JSON pagal pateiktą responseSchema, jokio kito teksto. Taisyklės: 1. Ištrauk tik kliento tekste arba formos laukuose tiesiogiai pateiktą informaciją. 2. Nežinomos reikšmės turi būti null arba praleistos, niekada nespėk. 3. serviceId tik iš activeServices arba null. 4. facts[].requirementKey tik iš pasirinktos paslaugos active decisionRequirements. 5. Kiekvienam ne-null faktui ir lokacijai privalomas pažodinis evidence iš rawText. 6. Niekada negrąžink kainos, termino, availability, auto-send ar atsakymo klientui; jei vis tiek žinai, nerašyk. 7. adminUnitCode nespėk: jei tekste yra tik gyvenvietė ar neaiški vieta, adminUnitCode turi būti null. 8. Rėžis (pvz. 1.5-1.7) → value=null, valueMin/valueMax skaičiai. 9. confidence turi būti 0.85-1.0 aiškiai tekste pagrįstiems faktams; mažesnę reikšmę naudok tik kai faktas dviprasmis. 10. Jei klientas aiškiai atsisako optional subject/add-on (pvz. „be vartų“, „vartų nereikia“), grąžink selection faktą su atitinkamu optional requirementKey, value=false ir negated=true.",
    user: JSON.stringify({
      mode: LLM_FIRST_PARSE_VERSION,
      rawText: input.inquiryMessage,
      formSignals: {
        selectedServiceId: normalizeOptional(input.serviceId),
        city: normalizeOptional(input.city),
        asksPrice: input.asksPrice,
        asksAvailability: input.asksAvailability,
        isUrgent: input.isUrgent,
      },
      activeServices: activeServices(rules).map((service) => ({
        id: service.id,
        name: service.name,
        label: service.label,
        keywords: service.keywords ?? [],
        offeringDescription: service.offeringDescription ?? null,
        offeringFollowup: service.offeringFollowup ?? null,
        subjects: subjectsForService(rules, service.id).map((subject) => ({
          subjectKey: subject.subjectKey,
          labelLt: subject.labelLt,
          descriptionLt: subject.descriptionLt,
          synonyms: subject.synonyms,
        })),
        decisionRequirements: activeRequirementsForService(
          rules,
          service.id,
        ).map((requirement) => ({
          requirementKey: requirement.requirementKey,
          label: requirement.label,
          required: requirement.required ?? true,
          affectsPrice: requirement.affectsPrice ?? false,
          questionTextIfMissing: requirement.questionTextIfMissing,
          expectedFact: requirement.expectedFact,
          validation: extractionValidation(requirement.validation),
        })),
      })),
      locationZones: (rules.locationZones ?? []).map((zone) => ({
        adminUnitCode: zone.adminUnitCode,
        zone: zone.zone,
        served: zone.served,
      })),
      responseSchema: {
        schemaVersion: LLM_FIRST_PARSE_VERSION,
        serviceId: "active_service_id_or_null",
        serviceEvidence: "pažodinė ištrauka arba null",
        intents: {
          asksPrice: false,
          asksAvailability: false,
          isUrgent: false,
          primaryIntent:
            "requests_quote | asks_offering | asks_availability | asks_process | provides_info | other | null",
        },
        location: {
          raw: "vietovė kaip parašyta tekste arba null",
          adminUnitCode: null,
          confidence: 0,
          evidence: "pažodinė ištrauka arba null",
        },
        facts: [
          {
            requirementKey: "requirement_key_from_selected_service",
            kind: "measurement",
            subject: "subject_key_or_null",
            dimension: "length",
            value: 0,
            valueMin: null,
            valueMax: null,
            unit: "m",
            evidence: "pažodinė ištrauka",
            confidence: 0.95,
            negated: false,
          },
        ],
        missingFields: ["requirement_key"],
      },
    }),
  };
}

function parseLlmFirstResponse(rawResponse: string): LlmFirstResponse | null {
  try {
    return llmFirstResponseSchema.parse(
      JSON.parse(stripJsonFence(rawResponse)),
    );
  } catch {
    return null;
  }
}

function applyLlmFirstResponse({
  input,
  rules,
  response,
}: {
  input: TestInquiryInput;
  rules: ClientRules;
  response: LlmFirstResponse;
}): {
  parsed: ParsedLeadData;
  rejectedFindings: LlmFirstRejectedFinding[];
} {
  const rejectedFindings: LlmFirstRejectedFinding[] = [];
  const service = resolveService({ input, rules, response, rejectedFindings });
  const location = resolveLlmLocation({
    rawText: input.inquiryMessage,
    response,
    rejectedFindings,
  });
  const facts = service.id
    ? applyLlmFacts({
        rawText: input.inquiryMessage,
        rules,
        serviceId: service.id,
        response,
        rejectedFindings,
      })
    : rejectFactsWithoutService(response, rejectedFindings);

  return {
    parsed: {
      schemaVersion: "lead_parse_v2",
      serviceId: service.id,
      serviceClassification: service.classification,
      city: normalizeOptional(input.city) ?? location?.adminUnit.label ?? null,
      asksPrice:
        input.asksPrice ||
        response.intents.asksPrice ||
        response.intents.primaryIntent === "requests_quote",
      asksAvailability:
        input.asksAvailability ||
        response.intents.asksAvailability ||
        response.intents.primaryIntent === "asks_availability",
      isUrgent: input.isUrgent || response.intents.isUrgent,
      primaryIntent: primaryIntentFromInput(input, response.intents),
      hasAttachments: false,
      source: "dashboard_test_form",
      parserVersion: LLM_FIRST_PARSE_VERSION,
      contacts: emptyContacts(),
      location,
      facts,
      resolvedRequirements: {},
      unresolvedRequirements: [],
      conflicts: [],
    },
    rejectedFindings,
  };
}

function resolveService({
  input,
  rules,
  response,
  rejectedFindings,
}: {
  input: TestInquiryInput;
  rules: ClientRules;
  response: LlmFirstResponse;
  rejectedFindings: LlmFirstRejectedFinding[];
}): { id: string | null; classification: ServiceClassification | null } {
  const services = activeServices(rules);
  const selectedServiceId = normalizeOptional(input.serviceId);
  const selectedService = selectedServiceId
    ? services.find((service) => service.id === selectedServiceId)
    : null;

  if (selectedService) {
    return {
      id: selectedService.id,
      classification: {
        id: selectedService.id,
        confidence: 1,
        source: "form_field",
        reason: "form_field",
        candidates: [
          {
            id: selectedService.id,
            confidence: 1,
            score: 1,
            matchedTerms: [],
          },
        ],
      },
    };
  }

  if (!response.serviceId) {
    // LLM nerado paslaugos — bet jei tekste įvardinta konkreti pasiūlos
    // rūšis, kurios nepadengia nė viena aktyvi paslauga, tai nėra
    // dviprasmybė: klientas prašo neteikiamo produkto.
    const unsupportedEvidence = findUnsupportedOfferingEvidence({
      rules,
      text: input.inquiryMessage,
    });
    if (unsupportedEvidence) {
      return {
        id: null,
        classification: {
          id: null,
          confidence: 0.6,
          source: "ai",
          reason: "unsupported_specific_service",
          evidence: unsupportedEvidence,
          evidenceVerified: true,
          candidates: [],
        },
      };
    }

    return { id: null, classification: null };
  }

  const service = services.find(
    (candidate) => candidate.id === response.serviceId,
  );
  if (!service) {
    rejectedFindings.push({
      type: "service",
      target: response.serviceId,
      reason: "SERVICE_NOT_IN_LIST",
    });
    return { id: null, classification: null };
  }

  const evidence = response.serviceEvidence?.trim();
  if (!evidence) {
    rejectedFindings.push({
      type: "service",
      target: response.serviceId,
      reason: "SERVICE_EVIDENCE_NOT_FOUND",
    });
    return { id: null, classification: null };
  }

  const verified = verifyAiEvidence({
    originalText: input.inquiryMessage,
    evidence,
  });
  if (!verified.ok) {
    rejectedFindings.push({
      type: "service",
      target: response.serviceId,
      reason:
        verified.reason === "VALUE_NOT_IN_EVIDENCE"
          ? "SERVICE_VALUE_NOT_IN_EVIDENCE"
          : "SERVICE_EVIDENCE_NOT_FOUND",
    });
    return { id: null, classification: null };
  }

  if (!serviceEvidenceIsSpecific({ service, rules, evidence })) {
    rejectedFindings.push({
      type: "service",
      target: response.serviceId,
      reason: "SERVICE_EVIDENCE_NOT_SPECIFIC",
    });
    // Nepakanka žiūrėti tik į LLM evidence iškarpą — LLM gali grąžinti vien
    // bendrinį žodį („tvoros"), nors tekste įvardinta konkreti neteikiama
    // rūšis („metalinę horizontalią"). Tikriname visą užklausos tekstą.
    const unsupportedEvidence =
      findUnsupportedOfferingEvidence({
        rules,
        text: input.inquiryMessage,
      }) ?? (serviceEvidenceNamesSpecificOffering(evidence) ? evidence : null);
    return {
      id: null,
      classification: {
        id: null,
        confidence: 0.6,
        source: "ai",
        reason: unsupportedEvidence
          ? "unsupported_specific_service"
          : "ambiguous",
        evidence: unsupportedEvidence ?? evidence,
        evidenceVerified: true,
        candidates: [
          {
            id: service.id,
            confidence: 0.6,
            score: 0,
            matchedTerms: [evidence],
          },
        ],
      },
    };
  }

  return {
    id: service.id,
    classification: {
      id: service.id,
      confidence: 0.9,
      source: "ai",
      reason: "ai_matched",
      evidence,
      evidenceVerified: true,
      candidates: [],
    },
  };
}

function resolveLlmLocation({
  rawText,
  response,
  rejectedFindings,
}: {
  rawText: string;
  response: LlmFirstResponse;
  rejectedFindings: LlmFirstRejectedFinding[];
}): AdminUnitLocation | null {
  const raw = response.location?.raw?.trim();
  if (!raw) {
    return null;
  }

  const evidence = response.location?.evidence?.trim() || raw;
  const verified = verifyAiEvidence({
    originalText: rawText,
    evidence,
  });
  if (!verified.ok) {
    rejectedFindings.push({
      type: "location",
      target: raw,
      reason:
        verified.reason === "VALUE_NOT_IN_EVIDENCE"
          ? "LOCATION_VALUE_NOT_IN_EVIDENCE"
          : "LOCATION_EVIDENCE_NOT_FOUND",
    });
    return null;
  }

  return resolveLocationText(raw);
}

function applyLlmFacts({
  rawText,
  rules,
  serviceId,
  response,
  rejectedFindings,
}: {
  rawText: string;
  rules: ClientRules;
  serviceId: string;
  response: LlmFirstResponse;
  rejectedFindings: LlmFirstRejectedFinding[];
}): ExtractedFact[] {
  const serviceSubjects = subjectsForService(rules, serviceId);
  const subjects = new Set(
    serviceSubjects.map((subject) => subject.subjectKey),
  );
  const requirements = activeRequirementsForService(rules, serviceId);
  const facts: ExtractedFact[] = [];

  for (const llmFact of response.facts) {
    const requirement = requirements.find(
      (candidate) => candidate.requirementKey === llmFact.requirementKey,
    );
    const fact = toExtractedFactCandidate({
      llmFact,
      requirement,
      subjects,
      nextId: `llm_fact_${facts.length + 1}`,
      rejectedFindings,
    });
    if (!fact) {
      continue;
    }

    const evidence = verifyAiEvidence({
      originalText: rawText,
      evidence: llmFact.evidence,
      value: llmFact.value,
      valueMin: llmFact.valueMin,
      valueMax: llmFact.valueMax,
    });
    if (!evidence.ok) {
      rejectedFindings.push({
        type: "fact",
        target: llmFact.requirementKey,
        reason: evidence.reason,
      });
      continue;
    }

    facts.push(fact);
  }

  facts.push(
    ...inferOptionalSubjectOptOutFacts({
      rawText,
      requirements,
      subjects: serviceSubjects,
      existingFacts: facts,
      firstIdIndex: facts.length + 1,
    }),
  );

  return facts;
}

function toExtractedFactCandidate({
  llmFact,
  requirement,
  subjects,
  nextId,
  rejectedFindings,
}: {
  llmFact: LlmFirstFact;
  requirement: DecisionRequirement | undefined;
  subjects: Set<string>;
  nextId: string;
  rejectedFindings: LlmFirstRejectedFinding[];
}): ExtractedFact | null {
  if (!requirement) {
    rejectedFindings.push({
      type: "fact",
      target: llmFact.requirementKey,
      reason: "REQUIREMENT_NOT_ALLOWED",
    });
    return null;
  }

  const expectedFact = asRecord(requirement.expectedFact);
  if (!expectedFact) {
    rejectedFindings.push({
      type: "fact",
      target: requirement.requirementKey,
      reason: "EXPECTED_FACT_UNSUPPORTED",
    });
    return null;
  }

  const expectedSubject =
    typeof expectedFact.subject === "string" ? expectedFact.subject : null;
  const subject = llmFact.subject ?? null;
  if (subject !== null && !subjects.has(subject)) {
    rejectedFindings.push({
      type: "fact",
      target: requirement.requirementKey,
      reason: "SUBJECT_NOT_ALLOWED",
    });
    return null;
  }
  if (expectedSubject !== null && subject !== expectedSubject) {
    rejectedFindings.push({
      type: "fact",
      target: requirement.requirementKey,
      reason: "EXPECTED_FACT_MISMATCH",
    });
    return null;
  }

  const fact: ExtractedFact = {
    id: nextId,
    requirementKey: requirement.requirementKey,
    kind: llmFact.kind as FactKind,
    subject,
    subjectSource: subject ? "ai" : null,
    dimension: (llmFact.dimension ?? null) as MeasurementDimension | null,
    value: llmFact.value,
    valueMin: llmFact.valueMin ?? null,
    valueMax: llmFact.valueMax ?? null,
    unit: (llmFact.unit ?? null) as ExtractedUnit | null,
    rawText: llmFact.evidence,
    evidenceVerified: true,
    source: "ai",
    confidence: normalizeLlmConfidence(llmFact.confidence),
    negated: llmFact.negated,
  };

  if (!hasFactValue(fact)) {
    rejectedFindings.push({
      type: "fact",
      target: requirement.requirementKey,
      reason: "NO_VALUE",
    });
    return null;
  }

  if (isOptionalRequirementOptOutFact(fact, requirement)) {
    return fact;
  }

  if (!factMatchesExpectedFact(fact, expectedFact)) {
    rejectedFindings.push({
      type: "fact",
      target: requirement.requirementKey,
      reason: "EXPECTED_FACT_MISMATCH",
    });
    return null;
  }

  return fact;
}

function inferOptionalSubjectOptOutFacts({
  rawText,
  requirements,
  subjects,
  existingFacts,
  firstIdIndex,
}: {
  rawText: string;
  requirements: DecisionRequirement[];
  subjects: ServiceSubjectRule[];
  existingFacts: ExtractedFact[];
  firstIdIndex: number;
}): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const subjectsByKey = new Map(
    subjects.map((subject) => [subject.subjectKey, subject]),
  );
  const claimedRequirementKeys = new Set(
    existingFacts
      .map((fact) => fact.requirementKey)
      .filter((key): key is string => typeof key === "string"),
  );
  let nextIndex = firstIdIndex;

  for (const requirement of requirements) {
    if ((requirement.required ?? true) !== false) {
      continue;
    }
    if (claimedRequirementKeys.has(requirement.requirementKey)) {
      continue;
    }

    const expectedFact = asRecord(requirement.expectedFact);
    const expectedSubject =
      typeof expectedFact?.subject === "string" ? expectedFact.subject : null;
    if (!expectedSubject) {
      continue;
    }

    const subject = subjectsByKey.get(expectedSubject);
    if (!subject) {
      continue;
    }

    const evidence = findSubjectOptOutEvidence(rawText, subject);
    if (!evidence) {
      continue;
    }

    facts.push({
      id: `llm_fact_${nextIndex}`,
      requirementKey: requirement.requirementKey,
      kind: "selection",
      subject: expectedSubject,
      subjectSource: "deterministic",
      dimension: null,
      value: false,
      valueMin: null,
      valueMax: null,
      unit: null,
      rawText: evidence,
      evidenceVerified: true,
      source: "deterministic",
      confidence: 1,
      negated: true,
    });
    claimedRequirementKeys.add(requirement.requirementKey);
    nextIndex += 1;
  }

  return facts;
}

function findSubjectOptOutEvidence(
  rawText: string,
  subject: ServiceSubjectRule,
): string | null {
  for (const term of subjectOptOutTerms(subject)) {
    const termPattern = escapeRegExp(term).replace(/\s+/gu, "\\s+");
    const patterns = [
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?<evidence>be\\s+${termPattern})(?![\\p{L}\\p{N}])`,
        "iu",
      ),
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?<evidence>${termPattern}\\s+(?:nebereikia|nereikia|nereikės|nereikes))(?![\\p{L}\\p{N}])`,
        "iu",
      ),
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])(?<evidence>(?:nebereikia|nereikia|nereikės|nereikes)\\s+${termPattern})(?![\\p{L}\\p{N}])`,
        "iu",
      ),
    ];

    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      const evidence = match?.groups?.evidence;
      if (evidence) {
        return evidence;
      }
    }
  }

  return null;
}

function subjectOptOutTerms(subject: ServiceSubjectRule): string[] {
  const terms = [subject.labelLt, subject.subjectKey, ...subject.synonyms]
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  const seen = new Set<string>();

  return terms
    .filter((term) => {
      const key = term.toLocaleLowerCase("lt-LT");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length);
}

function isOptionalRequirementOptOutFact(
  fact: ExtractedFact,
  requirement: DecisionRequirement,
): boolean {
  return (
    (requirement.required ?? true) === false &&
    fact.kind === "selection" &&
    fact.value === false &&
    fact.negated
  );
}

function rejectFactsWithoutService(
  response: LlmFirstResponse,
  rejectedFindings: LlmFirstRejectedFinding[],
): ExtractedFact[] {
  for (const fact of response.facts) {
    rejectedFindings.push({
      type: "fact",
      target: fact.requirementKey,
      reason: "NO_SERVICE",
    });
  }

  return [];
}

function emptyParsedLead(
  input: TestInquiryInput,
  rules: ClientRules,
): ParsedLeadData {
  const serviceId = normalizeOptional(input.serviceId);
  const service = serviceId
    ? activeServices(rules).find((candidate) => candidate.id === serviceId)
    : null;

  return {
    schemaVersion: "lead_parse_v2",
    serviceId: service?.id ?? null,
    serviceClassification: service
      ? {
          id: service.id,
          confidence: 1,
          source: "form_field",
          reason: "form_field",
          candidates: [
            { id: service.id, confidence: 1, score: 1, matchedTerms: [] },
          ],
        }
      : null,
    city: normalizeOptional(input.city),
    asksPrice: input.asksPrice,
    asksAvailability: input.asksAvailability,
    isUrgent: input.isUrgent,
    primaryIntent: input.asksPrice
      ? "requests_quote"
      : input.asksAvailability
        ? "asks_availability"
        : null,
    hasAttachments: false,
    source: "dashboard_test_form",
    parserVersion: LLM_FIRST_PARSE_VERSION,
    contacts: emptyContacts(),
    location: null,
    facts: [],
    resolvedRequirements: {},
    unresolvedRequirements: [],
    conflicts: [],
  };
}

function primaryIntentFromInput(
  input: TestInquiryInput,
  intents: LlmFirstResponse["intents"],
): PrimaryIntent | null {
  const asksPrice = input.asksPrice || intents.asksPrice;
  if (asksPrice && intents.primaryIntent === "asks_offering") {
    return "requests_quote";
  }

  return intents.primaryIntent;
}

function activeServices(rules: ClientRules): ServiceRule[] {
  return rules.services.filter((service) => service.active);
}

function subjectsForService(
  rules: ClientRules,
  serviceId: string,
): ServiceSubjectRule[] {
  return (rules.serviceSubjects ?? []).filter(
    (subject) => subject.serviceId === serviceId,
  );
}

function activeRequirementsForService(
  rules: ClientRules,
  serviceId: string,
): DecisionRequirement[] {
  return rules.decisionRequirements.filter(
    (requirement) => requirement.active && requirement.serviceId === serviceId,
  );
}

function extractionValidation(validation: RuleJson | undefined): RuleJson {
  const rule = asRecord(validation);
  if (!rule) {
    return null;
  }

  const allowedValues = Array.isArray(rule.allowedValues)
    ? rule.allowedValues
    : [];
  if (allowedValues.length > 0) {
    return { allowedValues };
  }

  const out: Record<string, unknown> = {};
  if (typeof rule.min === "number") {
    out.min = rule.min;
  }
  if (typeof rule.max === "number") {
    out.max = rule.max;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function hasFactValue(fact: ExtractedFact): boolean {
  if (fact.kind === "selection" && fact.value === false && fact.negated) {
    return true;
  }

  if (typeof fact.value === "string") {
    return fact.value.trim().length > 0;
  }

  if (fact.value !== null && fact.value !== undefined && fact.value !== false) {
    return true;
  }

  return typeof fact.valueMin === "number" || typeof fact.valueMax === "number";
}

function normalizeLlmConfidence(confidence: number): number {
  return confidence === 0 ? DEFAULT_VERIFIED_LLM_CONFIDENCE : confidence;
}

function emptyContacts(): ExtractedContacts {
  return { phone: null, email: null };
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
