import { resolveLocationText } from "@/lib/extractor/deterministic";
import type {
  AvailabilityRule,
  DecisionEngineInput,
  DecisionResult,
  LeadTimeEstimate,
  MatchedAvailabilityRule,
  PricingRule,
  ResolvedRequirementValue,
  RuleJson,
} from "@/lib/rules/types";

export function decideLeadResponse(input: DecisionEngineInput): DecisionResult {
  const base = baseDecision();

  if (input.conflicts.length > 0) {
    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "CONFLICTS",
      autoSendBlockedBy: ["CONFLICTS"],
    };
  }

  if (!input.service.id || input.service.confidence < 0.7) {
    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "SERVICE_AMBIGUOUS",
      autoSendBlockedBy: ["SERVICE_AMBIGUOUS"],
    };
  }

  if (isLocationNotServed(input)) {
    return {
      ...base,
      decision: "DECLINE_TEMPLATE",
      reason: "LOCATION_NOT_SERVED",
      autoSendBlockedBy: ["LOCATION_NOT_SERVED"],
    };
  }

  // Offering klausimas: paslauga jau atpažinta (service gate praėjo aukščiau).
  // Atsakymas TIK iš DB offering laukų; neišspręsti reikalavimai neblokuoja ir
  // klausimų nepridedame. Neatpažinta paslauga anksčiau tampa SERVICE_AMBIGUOUS.
  if (input.intents.primaryIntent === "asks_offering") {
    const service = input.rules.services.find(
      (candidate) => candidate.id === input.service.id,
    );
    const description = service?.offeringDescription?.trim();

    if (description) {
      return {
        ...base,
        decision: "OFFERING_ANSWER",
        reason: "OFFERING_MATCHED",
        offeringAnswer: {
          description,
          followup: service?.offeringFollowup?.trim() || null,
        },
        autoSendBlockedBy: ["OFFERING_ANSWER"],
      };
    }

    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "OFFERING_NOT_CONFIGURED",
      autoSendBlockedBy: ["OFFERING_NOT_CONFIGURED"],
    };
  }

  // Užimtumas taikomas tik kai klientas klausia termino / atvykimo laiko.
  // Price-only užklausoje ribotas užimtumas neturi blokuoti preliminarios kainos.
  const availability = input.intents.asksAvailability
    ? findAvailabilityMatch(input)
    : null;
  if (availability && availability.status === "unavailable") {
    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "AVAILABILITY_UNAVAILABLE",
      autoSendBlockedBy: ["AVAILABILITY_UNAVAILABLE"],
      matchedAvailabilityRule: toMatchedAvailabilityRule(availability),
    };
  }

  const requiredMissing = input.unresolvedRequirements
    .filter((requirement) => requirement.required)
    .sort((a, b) => Number(b.affectsPrice) - Number(a.affectsPrice));

  if (requiredMissing.length > 0) {
    return {
      ...base,
      decision: "ASK_MISSING_INFO",
      reason: "MISSING_REQUIRED_REQUIREMENTS",
      questionsToAsk: requiredMissing
        .slice(0, 3)
        .map((requirement) => requirement.question),
      autoSendBlockedBy: ["REQUIRED_REQUIREMENTS_UNRESOLVED"],
    };
  }

  const priceEstimate = findPriceEstimate(input);
  if (!priceEstimate) {
    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "NO_PRICING_RULE",
      autoSendBlockedBy: ["NO_PRICING_RULE"],
    };
  }

  const autoSendBlockedBy = autoSendBlockers(
    input,
    priceEstimate.pricingRuleId,
  );

  if (availability) {
    if (availability.status === "limited") {
      autoSendBlockedBy.push("AVAILABILITY_LIMITED");
    }
    if (!availability.autoSendAllowed) {
      autoSendBlockedBy.push("AVAILABILITY_AUTOSEND_DISABLED");
    }
  }

  return {
    ...base,
    decision: "PRICE_ESTIMATE",
    reason: "PRICE_RULE_MATCHED",
    priceEstimate,
    leadTime: input.intents.asksAvailability
      ? findLeadTime(input.rules.scheduleRules ?? [], availability)
      : null,
    autoSend: autoSendBlockedBy.length === 0,
    autoSendBlockedBy,
    matchedAvailabilityRule: availability
      ? toMatchedAvailabilityRule(availability)
      : null,
  };
}

// Užimtumo įrašo parinkimas: paslaugos įrašai be pasibaigusio galiojimo;
// tikslus regiono atitikmuo turi pirmenybę prieš įrašą be regiono („kitur").
function findAvailabilityMatch(
  input: DecisionEngineInput,
): AvailabilityRule | null {
  const serviceId = input.service.id;
  if (!serviceId) {
    return null;
  }

  const now = input.now ?? new Date();
  const candidates = (input.rules.availabilityRules ?? []).filter((rule) => {
    if (rule.serviceId !== serviceId) {
      return false;
    }
    if (!rule.validUntil) {
      return true;
    }
    return new Date(rule.validUntil).getTime() >= now.getTime();
  });

  if (candidates.length === 0) {
    return null;
  }

  // Tikslus atitikmuo pagal admin unit kodą (linksniai netrukdo: „Vilniuje"
  // ir „Vilnius" → tas pats kodas); atsarginis palyginimas — normalizuotas
  // tekstas (laisviems regionų pavadinimams, kurių alias žemėlapis nežino).
  const leadCode =
    input.location?.adminUnit.code ??
    resolveLocationText(input.city ?? "")?.adminUnit.code ??
    null;
  const leadText = normalizeLocation(input.location?.raw ?? input.city ?? "");

  if (leadCode || leadText) {
    const exact = candidates.find((rule) => {
      const ruleLocation = rule.location ?? "";
      if (!normalizeLocation(ruleLocation)) {
        return false;
      }
      const ruleCode = resolveLocationText(ruleLocation)?.adminUnit.code;
      if (ruleCode && leadCode) {
        return ruleCode === leadCode;
      }
      return normalizeLocation(ruleLocation) === leadText;
    });
    if (exact) {
      return exact;
    }
  }

  return (
    candidates.find((rule) => !normalizeLocation(rule.location ?? "")) ?? null
  );
}

function toMatchedAvailabilityRule(
  rule: AvailabilityRule,
): MatchedAvailabilityRule {
  return {
    id: rule.id,
    earliestStartText: rule.earliestStartText,
    validUntil: rule.validUntil
      ? new Date(rule.validUntil).toISOString()
      : null,
  };
}

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function baseDecision(): DecisionResult {
  return {
    decision: "MANUAL_REVIEW",
    reason: "NO_DECISION",
    priceEstimate: null,
    leadTime: null,
    questionsToAsk: [],
    autoSend: false,
    autoSendBlockedBy: [],
    offeringAnswer: null,
  };
}

function isLocationNotServed(input: DecisionEngineInput): boolean {
  const adminUnitCode = input.location?.adminUnit.code;
  if (!adminUnitCode) {
    return false;
  }

  const zone = (input.rules.locationZones ?? []).find(
    (candidate) => candidate.adminUnitCode === adminUnitCode,
  );

  return !zone?.served;
}

function findPriceEstimate(
  input: DecisionEngineInput,
): DecisionResult["priceEstimate"] {
  const serviceId = input.service.id;
  if (!serviceId) {
    return null;
  }

  for (const pricingRule of input.rules.pricingRules.filter(
    (rule) => rule.active && rule.serviceId === serviceId,
  )) {
    const rule = asRecord(pricingRule.rule);
    if (!rule || rule.type !== "per_unit") {
      continue;
    }

    const estimate = priceFromPerUnitRule(input, pricingRule, rule);
    if (estimate) {
      return estimate;
    }
  }

  return null;
}

function priceFromPerUnitRule(
  input: DecisionEngineInput,
  pricingRule: PricingRule,
  rule: Record<string, unknown>,
): DecisionResult["priceEstimate"] {
  const requirementKey = stringValue(rule.requirementKey);
  const currency = stringValue(rule.currency) ?? "EUR";
  const unit = stringValue(rule.unit);
  const pricePerUnit = numberValue(rule.pricePerUnit);

  if (!requirementKey || !unit || pricePerUnit === null) {
    return null;
  }

  const requiredKeys = Array.isArray(rule.requires)
    ? rule.requires.filter((key): key is string => typeof key === "string")
    : [requirementKey];

  if (!requiredKeys.every((key) => hasResolvedValue(input, key))) {
    return null;
  }

  const quantity = numericRequirementValue(
    input.resolvedRequirements[requirementKey],
  );
  if (quantity === null) {
    return null;
  }

  const unitPrice = pricePerUnit + modifierDelta(input, rule.modifiers);

  return {
    pricingRuleId: pricingRule.id,
    currency,
    unit,
    quantity,
    unitPrice,
    amount: roundMoney(quantity * unitPrice),
  };
}

function modifierDelta(input: DecisionEngineInput, modifiers: unknown): number {
  if (!Array.isArray(modifiers)) {
    return 0;
  }

  return modifiers.reduce((total, modifier) => {
    const record = asRecord(modifier);
    const condition = asRecord(record?.if);
    const requirementKey = stringValue(condition?.requirementKey);
    const gte = numberValue(condition?.gte);
    const pricePerUnitDelta = numberValue(record?.pricePerUnitDelta);

    if (!requirementKey || gte === null || pricePerUnitDelta === null) {
      return total;
    }

    const value = numericRequirementValue(
      input.resolvedRequirements[requirementKey],
    );

    return value !== null && value >= gte ? total + pricePerUnitDelta : total;
  }, 0);
}

function findLeadTime(
  scheduleRules: Array<{ rule: RuleJson }>,
  availability: AvailabilityRule | null = null,
): LeadTimeEstimate | null {
  // Regiono užimtumo terminas turi pirmenybę prieš bendrą schedule taisyklę.
  if (availability?.earliestStartText?.trim()) {
    return {
      minWeeks: null,
      maxWeeks: null,
      text: availability.earliestStartText.trim(),
    };
  }

  for (const scheduleRule of scheduleRules) {
    const rule = asRecord(scheduleRule.rule);
    if (rule?.type !== "lead_time_weeks") {
      continue;
    }

    const min = numberValue(rule.min);
    const max = numberValue(rule.max);
    if (min === null || max === null) {
      continue;
    }

    return {
      minWeeks: min,
      maxWeeks: max,
      text: `${min}-${max} sav.`,
    };
  }

  return null;
}

function autoSendBlockers(
  input: DecisionEngineInput,
  pricingRuleId: string,
): string[] {
  const blockers: string[] = [];
  const pricingRule = input.rules.pricingRules.find(
    (rule) => rule.id === pricingRuleId,
  );

  if (!pricingRule?.autoSendAllowed) {
    blockers.push("PRICING_RULE_BLOCKS_AUTOSEND");
  }

  const policy = asRecord(input.rules.autosendPolicies?.[0]?.policy);
  if (policy && policy.enabled !== true) {
    blockers.push("AUTOSEND_POLICY_DISABLED");
  }

  const confidenceBand = asRecord(policy?.confidenceBands);
  const minConfidence = numberValue(confidenceBand?.autoSend) ?? 0;
  blockers.push(
    ...serviceClassificationBlockers(input.service, policy, minConfidence),
  );

  if (
    Object.values(input.resolvedRequirements).some(
      (requirement) =>
        requirement !== null && requirement.confidence < minConfidence,
    )
  ) {
    blockers.push("CONFIDENCE_BELOW_AUTOSEND_BAND");
  }

  return blockers;
}

function serviceClassificationBlockers(
  service: DecisionEngineInput["service"],
  policy: Record<string, unknown> | null,
  defaultMinConfidence: number,
): string[] {
  if (service.source !== "ai") {
    return [];
  }

  const serviceGate = asRecord(policy?.serviceClassification);
  if (serviceGate?.aiAllowedForAutoSend === true) {
    return [];
  }

  const aiAllowedIf = asRecord(serviceGate?.aiAllowedIf);
  const minConfidence =
    numberValue(aiAllowedIf?.minConfidence) || defaultMinConfidence || 0.85;
  const blockers: string[] = [];

  if (
    aiAllowedIf?.evidenceVerified !== false &&
    service.evidenceVerified !== true
  ) {
    blockers.push("SERVICE_AI_EVIDENCE_BLOCKED");
  }

  if (service.confidence < minConfidence) {
    blockers.push("SERVICE_AI_CONFIDENCE_BLOCKED");
  }

  return blockers;
}

function hasResolvedValue(input: DecisionEngineInput, key: string): boolean {
  return numericRequirementValue(input.resolvedRequirements[key]) !== null;
}

function numericRequirementValue(
  requirement: ResolvedRequirementValue | null | undefined,
): number | null {
  if (!requirement) {
    return null;
  }

  return typeof requirement.value === "number" ? requirement.value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
