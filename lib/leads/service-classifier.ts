import { z } from "zod";
import {
  callOpenAiResponsesApi,
  isAiConfigured,
  stripJsonFence,
  type AiEnvironment,
  type AiModelCaller,
  type AiModelRequest,
} from "@/lib/ai/openai-client";
import {
  isGenericServiceTerm,
  normalizeServiceText,
  serviceEvidenceIsSpecific,
  serviceTextTokens,
} from "@/lib/leads/service-specificity";
import type { ClientRules, ServiceRule } from "@/lib/rules/types";
import { verifyAiEvidence } from "@/lib/verifier/evidence";

export type ServiceClassificationReason =
  | "form_field"
  | "matched_terms"
  | "no_match"
  | "ambiguous"
  | "ai_matched"
  | "unsupported_specific_service";

export type ServiceClassification = {
  id: string | null;
  confidence: number;
  source: "form_field" | "deterministic" | "ai";
  reason: ServiceClassificationReason;
  evidence?: string | null;
  evidenceVerified?: boolean;
  candidates: Array<{
    id: string;
    confidence: number;
    score: number;
    matchedTerms: string[];
  }>;
};

export type ServiceAiRejectReason =
  | "LOW_CONFIDENCE"
  | "EVIDENCE_NOT_FOUND"
  | "EVIDENCE_NOT_SPECIFIC"
  | "SERVICE_NOT_IN_LIST"
  | "NO_SERVICE"
  | "AI_PARSE_FAILED";

export type ServiceAiOutcome = {
  status: "skipped" | "ok" | "rejected";
  reason:
    | "DETERMINISTIC_MATCH"
    | "AMBIGUOUS"
    | "NOT_CONFIGURED"
    | "NO_ACTIVE_SERVICES"
    | "AI_MATCHED"
    | ServiceAiRejectReason;
  serviceId?: string | null;
  confidence?: number;
  evidence?: string;
  rawResponses?: string[];
};

const AI_SERVICE_MIN_CONFIDENCE = 0.8;

const aiServiceSchema = z.object({
  serviceId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

type AiServiceResponse = z.infer<typeof aiServiceSchema>;

type ServiceScore = {
  service: ServiceRule;
  score: number;
  matchedTerms: Set<string>;
};

export function classifyLeadService({
  requestedServiceId,
  message,
  rules,
}: {
  requestedServiceId?: string | null;
  message: string;
  rules: ClientRules;
}): ServiceClassification {
  const activeServices = rules.services.filter((service) => service.active);
  const requested = requestedServiceId?.trim();

  if (requested) {
    return {
      id: requested,
      confidence: 1,
      source: "form_field",
      reason: "form_field",
      candidates: [
        { id: requested, confidence: 1, score: 1, matchedTerms: [] },
      ],
    };
  }

  const normalizedMessage = normalizeServiceText(message);
  const scores = activeServices
    .map((service) => scoreService(service, rules, normalizedMessage))
    .filter((score) => score.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scores.length === 0) {
    return {
      id: null,
      confidence: 0,
      source: "deterministic",
      reason: "no_match",
      candidates: [],
    };
  }

  const top = scores[0];
  const second = scores[1] ?? null;
  const confidence = confidenceForScores(top.score, second?.score ?? 0);
  const candidates = scores.map((score) => ({
    id: score.service.id,
    confidence: confidenceForScores(score.score, 0),
    score: score.score,
    matchedTerms: Array.from(score.matchedTerms).sort(),
  }));

  if (top.score < 2 || (second && top.score - second.score < 2)) {
    return {
      id: null,
      confidence: Math.min(confidence, 0.6),
      source: "deterministic",
      reason: "ambiguous",
      candidates,
    };
  }

  return {
    id: top.service.id,
    confidence,
    source: "deterministic",
    reason: "matched_terms",
    candidates,
  };
}

// Deterministika lieka pirmas ir nekeičiamas žingsnis. AI kviečiamas TIK kai
// deterministika ambiguous arba no_match IR AI sukonfigūruotas. AI čia yra
// optional pagerinimas — nesukonfigūravus jokios klaidos (skirtingai nei gap
// filler): tiesiog lieka ambiguous.
export async function classifyLeadServiceWithFallback(
  params: {
    requestedServiceId?: string | null;
    message: string;
    rules: ClientRules;
  },
  options: { env?: AiEnvironment; callModel?: AiModelCaller } = {},
): Promise<{ classification: ServiceClassification; ai: ServiceAiOutcome }> {
  const deterministic = classifyLeadService(params);

  if (deterministic.id) {
    return {
      classification: deterministic,
      ai: { status: "skipped", reason: "DETERMINISTIC_MATCH" },
    };
  }

  // Tikros dviprasmybės (≥2 STIPRŪS ir artimi kandidatai, pvz. dvi tvorų rūšys)
  // AI nelaužo — tekstas matched, bet neišskiria konkretaus serviso → lieka
  // ambiguous, patikslinam su klientu. Silpną/vienintelį match'ą (score < 2) AI
  // vis tiek bando (žodyno spraga).
  const [topCandidate, secondCandidate] = deterministic.candidates;
  const genuineTie =
    deterministic.reason === "ambiguous" &&
    Boolean(topCandidate) &&
    Boolean(secondCandidate) &&
    (topCandidate.score === secondCandidate.score ||
      (topCandidate.score >= 2 &&
        secondCandidate.score >= 2 &&
        topCandidate.score - secondCandidate.score < 2));
  if (genuineTie) {
    return {
      classification: deterministic,
      ai: { status: "skipped", reason: "AMBIGUOUS" },
    };
  }

  const env = options.env ?? process.env;
  if (!isAiConfigured(env)) {
    return {
      classification: deterministic,
      ai: { status: "skipped", reason: "NOT_CONFIGURED" },
    };
  }

  const activeServices = params.rules.services.filter(
    (service) => service.active,
  );
  if (activeServices.length === 0) {
    return {
      classification: deterministic,
      ai: { status: "skipped", reason: "NO_ACTIVE_SERVICES" },
    };
  }

  const request = buildAiServiceRequest(
    params.message,
    activeServices,
    params.rules,
    env,
  );
  const callModel = options.callModel ?? callOpenAiResponsesApi;
  const rawResponses: string[] = [];
  let parsed: AiServiceResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawResponse = await callModel(request);
    rawResponses.push(rawResponse);
    parsed = parseAiServiceResponse(rawResponse);
    if (parsed) {
      break;
    }
  }

  const reject = (
    reason: ServiceAiRejectReason,
    extra: Partial<ServiceAiOutcome> = {},
  ): { classification: ServiceClassification; ai: ServiceAiOutcome } => ({
    classification: deterministic,
    ai: { status: "rejected", reason, rawResponses, ...extra },
  });

  if (!parsed) {
    return reject("AI_PARSE_FAILED");
  }

  if (parsed.serviceId === null) {
    return reject("NO_SERVICE");
  }

  const service = activeServices.find(
    (candidate) => candidate.id === parsed.serviceId,
  );
  if (!service) {
    return reject("SERVICE_NOT_IN_LIST", { serviceId: parsed.serviceId });
  }

  if (parsed.confidence < AI_SERVICE_MIN_CONFIDENCE) {
    return reject("LOW_CONFIDENCE", {
      serviceId: parsed.serviceId,
      confidence: parsed.confidence,
    });
  }

  const evidence = verifyAiEvidence({
    originalText: params.message,
    evidence: parsed.evidence,
  });
  if (!evidence.ok) {
    return reject("EVIDENCE_NOT_FOUND", { serviceId: parsed.serviceId });
  }

  if (
    !serviceEvidenceIsSpecific({
      service,
      rules: params.rules,
      evidence: parsed.evidence,
    })
  ) {
    return reject("EVIDENCE_NOT_SPECIFIC", { serviceId: parsed.serviceId });
  }

  return {
    classification: {
      id: parsed.serviceId,
      confidence: parsed.confidence,
      source: "ai",
      reason: "ai_matched",
      evidence: parsed.evidence,
      evidenceVerified: true,
      candidates: deterministic.candidates,
    },
    ai: {
      status: "ok",
      reason: "AI_MATCHED",
      serviceId: parsed.serviceId,
      confidence: parsed.confidence,
      evidence: parsed.evidence,
      rawResponses,
    },
  };
}

function buildAiServiceRequest(
  message: string,
  activeServices: ServiceRule[],
  rules: ClientRules,
  env: AiEnvironment,
): AiModelRequest {
  return {
    model: env.OPENAI_MODEL?.trim() ?? "",
    system:
      "Tu esi paslaugų klasifikatorius. Iš pateikto AKTYVIŲ paslaugų sąrašo parink TIK VIENĄ, geriausiai atitinkančią kliento tekstą, arba grąžink serviceId=null jei nė viena netinka. Grąžink TIK validų JSON, jokio kito teksto. Taisyklės: 1. serviceId TIK iš pateikto sąrašo arba null. 2. Privalomas evidence — pažodinis teksto fragmentas, dėl kurio taip nusprendei. 3. Viena paslauga sąraše NEREIŠKIA automatinio pasirinkimo — vis tiek privalai turėti evidence arba grąžinti null. 4. NEKURK reikšmių, kurių nėra tekste. 5. Jei kelios paslaugos tinka vienodai arba tekstas nenurodo konkrečios (pvz. paminėta tik bendra kategorija, o rūšis nenurodyta) → grąžink serviceId=null. NESPĖK.",
    user: JSON.stringify({
      rawText: message,
      activeServices: activeServices.map((service) => ({
        id: service.id,
        label: service.label,
        name: service.name,
        keywords: service.keywords ?? [],
        offeringDescription: service.offeringDescription ?? null,
        offeringFollowup: service.offeringFollowup ?? null,
        subjects: (rules.serviceSubjects ?? [])
          .filter((subject) => subject.serviceId === service.id)
          .map((subject) => ({
            label: subject.labelLt,
            description: subject.descriptionLt,
            synonyms: subject.synonyms,
          })),
      })),
      responseSchema: {
        serviceId: "paslaugos_id_arba_null",
        confidence: 0.0,
        evidence: "pažodinė ištrauka",
      },
    }),
  };
}

function parseAiServiceResponse(rawResponse: string): AiServiceResponse | null {
  try {
    return aiServiceSchema.parse(JSON.parse(stripJsonFence(rawResponse)));
  } catch {
    return null;
  }
}

function scoreService(
  service: ServiceRule,
  rules: ClientRules,
  normalizedMessage: string,
): ServiceScore {
  const matchedTerms = new Set<string>();
  let score = 0;

  for (const keyword of service.keywords ?? []) {
    score += scoreTerm(keyword, normalizedMessage, 4, matchedTerms);
  }

  score += scoreTextTerms(service.name, normalizedMessage, 2, matchedTerms);
  score += scoreTextTerms(
    service.label ?? "",
    normalizedMessage,
    2,
    matchedTerms,
  );

  for (const subject of rules.serviceSubjects ?? []) {
    if (subject.serviceId !== service.id) {
      continue;
    }

    score += scoreTextTerms(
      subject.labelLt,
      normalizedMessage,
      1,
      matchedTerms,
    );
    score += scoreTextTerms(
      subject.descriptionLt,
      normalizedMessage,
      1,
      matchedTerms,
    );

    for (const synonym of subject.synonyms) {
      score += scoreTerm(synonym, normalizedMessage, 2, matchedTerms);
    }
  }

  for (const rule of rules.pricingRules) {
    if (rule.serviceId === service.id && rule.active) {
      score += scoreTextTerms(rule.name, normalizedMessage, 2, matchedTerms);
    }
  }

  for (const requirement of rules.decisionRequirements) {
    if (requirement.serviceId !== service.id || !requirement.active) {
      continue;
    }

    score += scoreTextTerms(
      requirement.label,
      normalizedMessage,
      1,
      matchedTerms,
    );
    score += scoreTextTerms(
      requirement.questionTextIfMissing,
      normalizedMessage,
      1,
      matchedTerms,
    );
  }

  return { service, score, matchedTerms };
}

function scoreTextTerms(
  text: string,
  normalizedMessage: string,
  baseWeight: number,
  matchedTerms: Set<string>,
): number {
  return tokens(text).reduce(
    (total, token) =>
      total +
      scoreNormalizedTerm(token, normalizedMessage, baseWeight, matchedTerms),
    0,
  );
}

function scoreTerm(
  term: string,
  normalizedMessage: string,
  baseWeight: number,
  matchedTerms: Set<string>,
): number {
  const normalizedTerm = normalizeServiceText(term);
  return scoreNormalizedTerm(
    normalizedTerm,
    normalizedMessage,
    baseWeight,
    matchedTerms,
  );
}

function scoreNormalizedTerm(
  normalizedTerm: string,
  normalizedMessage: string,
  baseWeight: number,
  matchedTerms: Set<string>,
): number {
  if (!normalizedTerm || !hasPhrase(normalizedMessage, normalizedTerm)) {
    return 0;
  }

  if (matchedTerms.has(normalizedTerm)) {
    return 0;
  }

  matchedTerms.add(normalizedTerm);
  return isGenericServiceTerm(normalizedTerm) ? 1 : baseWeight;
}

function confidenceForScores(topScore: number, secondScore: number): number {
  if (topScore <= 0) {
    return 0;
  }

  if (secondScore <= 0) {
    return 0.95;
  }

  const gapRatio = (topScore - secondScore) / topScore;
  return roundConfidence(0.7 + Math.min(0.25, Math.max(0, gapRatio) * 0.5));
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

function tokens(text: string): string[] {
  return serviceTextTokens(text);
}

function hasPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}
