import { resolveLocationText } from "@/lib/extractor/deterministic";
import { hasGateAndAutomationCandidates } from "@/lib/leads/service-classifier";
import { normalizeServiceText } from "@/lib/leads/service-specificity";
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
    const validationQuestions = input.conflicts
      .filter(
        (conflict) =>
          conflict.reason === "VALUE_OUT_OF_RANGE" ||
          conflict.reason === "VALUE_NOT_ALLOWED",
      )
      .map((conflict) => conflict.clarificationQuestion?.trim())
      .filter((question): question is string => Boolean(question));
    if (
      validationQuestions.length === input.conflicts.length &&
      validationQuestions.length > 0
    ) {
      return {
        ...base,
        decision: "ASK_MISSING_INFO",
        reason: "VALIDATION_FAILED",
        questionsToAsk: Array.from(new Set(validationQuestions)).slice(0, 3),
        autoSendBlockedBy: ["VALIDATION_FAILED"],
      };
    }

    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "CONFLICTS",
      autoSendBlockedBy: ["CONFLICTS"],
    };
  }

  // Žmogaus įvertinimo signalai (apžiūra vietoje, nežinoma esamos
  // konstrukcijos būklė) → manual review nepriklausomai nuo paslaugos ar
  // kainodaros: kaina be įvertinimo būtų nepagrįsta. competitor_price čia
  // NEpatenka — jis tik blokuoja auto-send (žr. autoSendBlockers), kad
  // žmogus nuspręstų dėl kainos palyginimo, bet draft'as paruošiamas.
  const assessmentSignals = (input.reviewSignals ?? []).filter(
    (signal) => signal.type !== "competitor_price",
  );
  if (assessmentSignals.length > 0) {
    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "REVIEW_SIGNALS",
      autoSendBlockedBy: assessmentSignals.map(
        (signal) => `REVIEW_SIGNAL:${signal.type}`,
      ),
    };
  }

  if (!input.service.id || input.service.confidence < 0.7) {
    if (input.service.reason === "unsupported_specific_service") {
      return {
        ...base,
        decision: "MANUAL_REVIEW",
        reason: "SERVICE_UNSUPPORTED",
        autoSendBlockedBy: ["SERVICE_UNSUPPORTED"],
        manualReviewDraftText: buildUnsupportedServiceDraft(input),
      };
    }

    const serviceClarificationQuestion = !input.service.id
      ? buildServiceClarificationQuestion(input)
      : null;
    if (serviceClarificationQuestion) {
      return {
        ...base,
        decision: "ASK_MISSING_INFO",
        reason: "SERVICE_AMBIGUOUS",
        questionsToAsk: [serviceClarificationQuestion],
        autoSendBlockedBy: ["SERVICE_AMBIGUOUS"],
      };
    }

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
    return {
      ...base,
      decision: "OFFERING_ANSWER",
      reason: service?.offeringDescription?.trim()
        ? "OFFERING_MATCHED"
        : "OFFERING_SAFE_FALLBACK",
      offeringAnswer: buildOfferingAnswer(input, service),
      autoSendBlockedBy: ["OFFERING_ANSWER"],
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

  const pricing = findPriceEstimate(input);
  if (pricing.status !== "matched") {
    if (pricing.status !== "no_rule") {
      return {
        ...base,
        decision: "MANUAL_REVIEW",
        reason: pricing.reason,
        autoSendBlockedBy: [pricing.reason],
        pricingDiagnostic: pricing.diagnostic,
      };
    }

    return {
      ...base,
      decision: "MANUAL_REVIEW",
      reason: "NO_PRICING_RULE",
      autoSendBlockedBy: ["NO_PRICING_RULE"],
    };
  }

  const autoSendBlockedBy = autoSendBlockers(
    input,
    pricing.estimate.pricingRuleId,
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
    priceEstimate: pricing.estimate,
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
    manualReviewDraftText: null,
    pricingDiagnostic: null,
  };
}

function buildUnsupportedServiceDraft(input: DecisionEngineInput): string {
  const evidence = input.service.evidence?.trim();
  if (evidence && /saules\s+elektrin/u.test(normalizeServiceText(evidence))) {
    return "Šiuo metu saulės elektrinių montavimo paslaugos neteikiame.";
  }
  if (evidence) {
    return `Sveiki, ačiū už užklausą. Pagal pateiktą informaciją prašote paslaugos: „${evidence}“. Šiuo metu tokios paslaugos neteikiame.`;
  }

  return "Sveiki, ačiū už užklausą. Šiuo metu tokios paslaugos neteikiame.";
}

function buildServiceClarificationQuestion(
  input: DecisionEngineInput,
): string | null {
  const candidateIds = new Set(
    (input.service.candidates ?? []).map((candidate) => candidate.id),
  );
  if (candidateIds.size === 0) {
    return null;
  }

  const candidates = input.rules.services.filter(
    (service) => service.active && candidateIds.has(service.id),
  );
  if (candidates.length === 0) {
    return null;
  }

  if (
    input.service.reason === "multiple_services" &&
    hasGateAndAutomationCandidates(
      candidates.map((service) => service.id),
      input.rules,
    )
  ) {
    return "Ar reikia naujų vartų, automatikos esamiems vartams, ar abiejų sprendimų?";
  }

  if (candidates.some((service) => serviceLooksLikeFence(service.id, input))) {
    return "Kokio tipo tvorą svarstote?";
  }

  return "Patikslinkite, kokios paslaugos reikia?";
}

function serviceLooksLikeFence(
  serviceId: string,
  input: DecisionEngineInput,
): boolean {
  const service = input.rules.services.find(
    (candidate) => candidate.id === serviceId,
  );
  if (!service) {
    return false;
  }

  const text = normalizeServiceText(
    [
      service.name,
      service.label ?? "",
      ...(service.keywords ?? []),
      ...(input.rules.serviceSubjects ?? [])
        .filter((subject) => subject.serviceId === serviceId)
        .flatMap((subject) => [
          subject.labelLt,
          subject.descriptionLt,
          ...subject.synonyms,
        ]),
    ].join(" "),
  );

  return text.split(" ").some((token) => token.startsWith("tvor"));
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

type PriceResolution =
  | {
      status: "matched";
      estimate: NonNullable<DecisionResult["priceEstimate"]>;
    }
  | { status: "no_rule" }
  | {
      status: "invalid";
      reason:
        | "PRICING_RULE_UNSUPPORTED"
        | "PRICING_RULE_NOT_CURRENT"
        | "PRICING_RULE_REQUIREMENTS_UNRESOLVED";
      diagnostic: string;
    };

function findPriceEstimate(input: DecisionEngineInput): PriceResolution {
  const serviceId = input.service.id;
  if (!serviceId) {
    return { status: "no_rule" };
  }

  const activeServiceRules = input.rules.pricingRules.filter(
    (rule) => rule.active && rule.serviceId === serviceId,
  );
  const currentRules = activeServiceRules.filter((rule) =>
    isPricingRuleCurrent(rule, input.now ?? new Date()),
  );
  if (currentRules.length === 0) {
    if (activeServiceRules.length > 0) {
      return {
        status: "invalid",
        reason: "PRICING_RULE_NOT_CURRENT",
        diagnostic:
          "Paslaugai yra aktyvi kainodaros taisyklė, tačiau ji šiuo metu negalioja pagal validFrom/validTo.",
      };
    }
    return { status: "no_rule" };
  }

  let firstInvalid: Extract<PriceResolution, { status: "invalid" }> | null =
    null;
  for (const pricingRule of currentRules) {
    const rule = asRecord(pricingRule.rule);
    if (!rule) {
      firstInvalid ??= unsupportedPricingRule(
        pricingRule,
        "rule JSON nėra objektas",
      );
      continue;
    }

    if (rule.type !== "per_unit" && rule.type !== "range_estimate") {
      firstInvalid ??= unsupportedPricingRule(
        pricingRule,
        `nepalaikomas tipas „${String(rule.type)}“`,
      );
      continue;
    }

    const requirementKey = stringValue(rule.requirementKey);
    const unit = stringValue(rule.unit);
    if (!requirementKey || !unit) {
      firstInvalid ??= unsupportedPricingRule(
        pricingRule,
        "trūksta rule.requirementKey arba rule.unit",
      );
      continue;
    }

    const requiredKeys = requiredKeysForRule(rule, requirementKey);
    const missingKeys = requiredKeys.filter(
      (key) => !hasResolvedValue(input, key),
    );
    if (missingKeys.length > 0) {
      firstInvalid ??= {
        status: "invalid",
        reason: "PRICING_RULE_REQUIREMENTS_UNRESOLVED",
        diagnostic: `Kainodaros taisyklei „${pricingRule.name}“ trūksta išspręstų reikšmių: ${missingKeys.join(", ")}.`,
      };
      continue;
    }

    if (rule.type === "range_estimate") {
      const estimate = priceFromRangeRule(
        input,
        pricingRule,
        rule,
        requirementKey,
        unit,
      );
      if (estimate) {
        return { status: "matched", estimate };
      }
      firstInvalid ??= unsupportedPricingRule(
        pricingRule,
        "range_estimate reikia skaitinių priceMin ir priceMax bei skaitinės requirement reikšmės",
      );
      continue;
    }

    const estimate = priceFromPerUnitRule(input, pricingRule, rule);
    if (estimate) {
      return { status: "matched", estimate };
    }
    firstInvalid ??= unsupportedPricingRule(
      pricingRule,
      "per_unit struktūra nepilna arba kiekio reikšmė nėra skaitinė",
    );
  }

  return (
    firstInvalid ?? {
      status: "invalid",
      reason: "PRICING_RULE_UNSUPPORTED",
      diagnostic:
        "Aktyvi kainodaros taisyklė rasta, bet jos nepavyko pritaikyti.",
    }
  );
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

function priceFromRangeRule(
  input: DecisionEngineInput,
  pricingRule: PricingRule,
  rule: Record<string, unknown>,
  requirementKey: string,
  unit: string,
): NonNullable<DecisionResult["priceEstimate"]> | null {
  const amountMin = pricingRule.priceMin;
  const amountMax = pricingRule.priceMax;
  const quantity = numericRequirementValue(
    input.resolvedRequirements[requirementKey],
  );
  if (
    amountMin === null ||
    amountMax === null ||
    amountMin > amountMax ||
    quantity === null
  ) {
    return null;
  }

  return {
    pricingRuleId: pricingRule.id,
    currency: stringValue(rule.currency) ?? "EUR",
    unit: pricingRule.unit?.trim() || unit,
    quantity,
    unitPrice: null,
    amount: null,
    amountMin: roundMoney(amountMin),
    amountMax: roundMoney(amountMax),
  };
}

function requiredKeysForRule(
  rule: Record<string, unknown>,
  requirementKey: string,
): string[] {
  return Array.isArray(rule.requires)
    ? Array.from(
        new Set([
          requirementKey,
          ...rule.requires.filter(
            (key): key is string => typeof key === "string",
          ),
        ]),
      )
    : [requirementKey];
}

function isPricingRuleCurrent(rule: PricingRule, now: Date): boolean {
  const nowTime = now.getTime();
  const validFrom = rule.validFrom ? new Date(rule.validFrom).getTime() : null;
  const validTo = rule.validTo ? new Date(rule.validTo).getTime() : null;
  return (
    (validFrom === null || Number.isNaN(validFrom) || validFrom <= nowTime) &&
    (validTo === null || Number.isNaN(validTo) || validTo >= nowTime)
  );
}

function unsupportedPricingRule(
  rule: PricingRule,
  detail: string,
): Extract<PriceResolution, { status: "invalid" }> {
  return {
    status: "invalid",
    reason: "PRICING_RULE_UNSUPPORTED",
    diagnostic: `Kainodaros taisyklė „${rule.name}“ techniškai nepalaikoma: ${detail}.`,
  };
}

function buildOfferingAnswer(
  input: DecisionEngineInput,
  service: DecisionEngineInput["rules"]["services"][number] | undefined,
): NonNullable<DecisionResult["offeringAnswer"]> {
  const serviceLabel = service?.label?.trim() || service?.name.trim();
  const description =
    service?.offeringDescription?.trim() ||
    (serviceLabel
      ? `Taip, šią paslaugą teikiame: ${serviceLabel}.`
      : "Taip, šią paslaugą teikiame.");
  const hasRequiredMissing = input.unresolvedRequirements.some(
    (requirement) => requirement.required,
  );
  const pricing = hasRequiredMissing
    ? null
    : findPriceEstimate({ ...input, intents: { ...input.intents } });
  const followup =
    pricing?.status === "matched"
      ? `Orientacinė kaina: ${formatPriceAmount(pricing.estimate)} ${pricing.estimate.currency}.`
      : service?.offeringFollowup?.trim() ||
        input.unresolvedRequirements.find((requirement) => requirement.required)
          ?.question ||
        null;

  return { description, followup };
}

function formatPriceAmount(
  estimate: NonNullable<DecisionResult["priceEstimate"]>,
): string {
  if (
    typeof estimate.amountMin === "number" &&
    typeof estimate.amountMax === "number"
  ) {
    return `${formatNumber(estimate.amountMin)}–${formatNumber(estimate.amountMax)}`;
  }
  return typeof estimate.amount === "number"
    ? formatNumber(estimate.amount)
    : "";
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(".", ",");
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

  // Skubi užklausa: draft'as su kaina paruošiamas, bet siunčia žmogus —
  // skuba gali reikšti kitą kainodarą ar terminų derinimą.
  if (input.intents.isUrgent) {
    blockers.push("URGENT");
  }

  // Klientas lygina gautą pasiūlymą: kainą paskaičiuojame pagal taisykles,
  // bet žmogus nusprendžia, ar ir kaip konkuruoti — jokių pažadų automatu.
  if (
    (input.reviewSignals ?? []).some(
      (signal) => signal.type === "competitor_price",
    )
  ) {
    blockers.push("REVIEW_SIGNAL:competitor_price");
  }

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
