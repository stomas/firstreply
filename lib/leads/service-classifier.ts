import type { ClientRules, ServiceRule } from "@/lib/rules/types";

export type ServiceClassificationReason =
  | "form_field"
  | "matched_terms"
  | "no_match"
  | "ambiguous";

export type ServiceClassification = {
  id: string | null;
  confidence: number;
  source: "form_field" | "deterministic";
  reason: ServiceClassificationReason;
  candidates: Array<{
    id: string;
    confidence: number;
    score: number;
    matchedTerms: string[];
  }>;
};

type ServiceScore = {
  service: ServiceRule;
  score: number;
  matchedTerms: Set<string>;
};

const genericTerms = new Set([
  "dev",
  "ir",
  "bei",
  "su",
  "pagal",
  "gamyba",
  "gamybos",
  "montavimas",
  "montavimo",
  "paslauga",
  "paslaugos",
  "reikia",
  "domina",
  "tvora",
  "tvoros",
  "tvora",
  "tvorai",
  "aptverimas",
  "sklypo",
]);

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

  const normalizedMessage = normalizeText(message);
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
  const normalizedTerm = normalizeText(term);
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

  matchedTerms.add(normalizedTerm);
  return genericTerms.has(normalizedTerm) ? 1 : baseWeight;
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
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function hasPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  return ` ${normalizedText} `.includes(` ${normalizedPhrase} `);
}

function normalizeText(value: string): string {
  return value
    .replace(/²/gu, "2")
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
