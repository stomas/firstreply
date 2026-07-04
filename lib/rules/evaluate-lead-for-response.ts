import type {
  AvailabilityRule,
  ClientRules,
  DraftGenerationInput,
  EvaluationLead,
  LeadEvaluationResult,
  MatchedAvailabilityRule,
  MatchedPricingRule,
  MissingRequirement,
  ResponseType,
} from "./types";

type EvaluateOptions = {
  now?: Date;
  generateDraft?: (input: DraftGenerationInput) => Promise<string>;
};

export async function evaluateLeadForResponse(
  lead: EvaluationLead,
  rules: ClientRules,
  options: EvaluateOptions = {},
): Promise<LeadEvaluationResult> {
  const now = options.now ?? new Date();
  const manualReviewReasons: string[] = [];
  const missingRequirements: MissingRequirement[] = [];
  const activeService = lead.serviceId
    ? rules.services.find(
        (service) => service.id === lead.serviceId && service.active,
      )
    : null;

  if (!lead.serviceId) {
    manualReviewReasons.push("nėra atpažintos paslaugos");
  } else if (!activeService) {
    manualReviewReasons.push("nėra aktyvios paslaugos");
  }

  const matchedPricingRules = activeService
    ? rules.pricingRules
        .filter((rule) => rule.active && rule.serviceId === activeService.id)
        .map<MatchedPricingRule>((rule) => ({
          id: rule.id,
          name: rule.name,
          priceMin: rule.priceMin,
          priceMax: rule.priceMax,
          unit: rule.unit,
        }))
    : [];

  if (activeService && lead.asksPrice && matchedPricingRules.length === 0) {
    manualReviewReasons.push("nėra kainų taisyklės");
  }

  if (
    activeService &&
    lead.asksPrice &&
    rules.pricingRules.some(
      (rule) =>
        rule.active &&
        rule.serviceId === activeService.id &&
        !rule.autoSendAllowed,
    )
  ) {
    manualReviewReasons.push("kainų taisyklė neleidžia auto-send");
  }

  if (activeService) {
    const requirements = rules.decisionRequirements
      .filter(
        (requirement) =>
          requirement.active && requirement.serviceId === activeService.id,
      )
      .sort((a, b) => a.priority - b.priority);

    for (const requirement of requirements) {
      if (hasRequirementValue(lead, requirement.requirementKey)) {
        continue;
      }

      const missing = {
        key: requirement.requirementKey,
        label: requirement.label,
        question: requirement.questionTextIfMissing,
      };
      missingRequirements.push(missing);

      if (requirement.blocksAutoSend) {
        manualReviewReasons.push(
          `trūksta informacijos, kuri blokuoja auto-send: ${requirement.label}`,
        );
      }
    }
  }

  const matchedAvailabilityRule =
    activeService && lead.asksAvailability
      ? matchAvailabilityRule(
          rules.availabilityRules.filter(
            (rule) => rule.serviceId === activeService.id,
          ),
          lead.city,
          now,
          manualReviewReasons,
        )
      : null;

  if (lead.isUrgent) {
    manualReviewReasons.push("klientas pažymėtas kaip skubus");
  }

  if (lead.hasAttachments) {
    manualReviewReasons.push("užklausa nepatenka į standartines taisykles");
  }

  const responseType = getResponseType(
    missingRequirements,
    manualReviewReasons,
    lead,
  );
  const autoSendAllowed =
    manualReviewReasons.length === 0 &&
    matchedPricingAutoSendAllowed(activeService?.id ?? null, rules, lead) &&
    matchedAvailabilityAutoSendAllowed(matchedAvailabilityRule, rules);
  const canGenerateResponse =
    manualReviewReasons.length === 0 &&
    (matchedPricingRules.length > 0 || missingRequirements.length > 0);

  const baseResult: LeadEvaluationResult = {
    leadId: lead.id,
    serviceId: activeService?.id ?? null,
    canGenerateResponse,
    autoSendAllowed,
    responseType,
    missingRequirements,
    matchedPricingRules,
    matchedAvailabilityRule,
    manualReviewReasons,
    draftText: null,
  };

  if (!canGenerateResponse) {
    return baseResult;
  }

  try {
    const draftText = await options.generateDraft?.({
      lead,
      leadId: baseResult.leadId,
      serviceId: baseResult.serviceId,
      autoSendAllowed: baseResult.autoSendAllowed,
      responseType: baseResult.responseType,
      missingRequirements: baseResult.missingRequirements,
      matchedPricingRules: baseResult.matchedPricingRules,
      matchedAvailabilityRule: baseResult.matchedAvailabilityRule,
      manualReviewReasons: baseResult.manualReviewReasons,
    });

    return {
      ...baseResult,
      draftText: draftText ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "response generation error";
    return {
      ...baseResult,
      canGenerateResponse: false,
      autoSendAllowed: false,
      responseType: "manual_review",
      manualReviewReasons: [message],
      draftText: null,
    };
  }
}

function hasRequirementValue(lead: EvaluationLead, key: string): boolean {
  const directValues: Record<string, unknown> = {
    city: lead.city,
    original_message: lead.originalMessage,
    asks_price: lead.asksPrice,
    asks_availability: lead.asksAvailability,
    is_urgent: lead.isUrgent,
    has_attachments: lead.hasAttachments,
  };
  const value = directValues[key] ?? lead.parsedJson?.[key];

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== null && value !== undefined && value !== false;
}

function matchAvailabilityRule(
  rules: AvailabilityRule[],
  city: string | null,
  now: Date,
  manualReviewReasons: string[],
): MatchedAvailabilityRule | null {
  const activeRule =
    rules.find((rule) => rule.location && cityMatches(rule.location, city)) ??
    rules.find((rule) => !rule.location);

  if (!activeRule) {
    manualReviewReasons.push("užklausa nepatenka į standartines taisykles");
    return null;
  }

  if (activeRule.validUntil && new Date(activeRule.validUntil) < now) {
    manualReviewReasons.push("užimtumo taisyklė pasenusi");
  }

  if (activeRule.status !== "available") {
    manualReviewReasons.push("užklausa nepatenka į standartines taisykles");
  }

  if (!activeRule.autoSendAllowed) {
    manualReviewReasons.push("užimtumo taisyklė neleidžia auto-send");
  }

  return {
    id: activeRule.id,
    earliestStartText: activeRule.earliestStartText,
    validUntil: activeRule.validUntil
      ? new Date(activeRule.validUntil).toISOString()
      : null,
  };
}

function getResponseType(
  missingRequirements: MissingRequirement[],
  manualReviewReasons: string[],
  lead: EvaluationLead,
): ResponseType {
  if (missingRequirements.length > 0) {
    return "missing_info";
  }

  if (manualReviewReasons.length > 0) {
    return "manual_review";
  }

  if (lead.asksPrice || lead.asksAvailability) {
    return "price_availability";
  }

  return "manual_review";
}

function matchedPricingAutoSendAllowed(
  serviceId: string | null,
  rules: ClientRules,
  lead: EvaluationLead,
): boolean {
  if (!serviceId || !lead.asksPrice) {
    return true;
  }

  const matchedRules = rules.pricingRules.filter(
    (rule) => rule.active && rule.serviceId === serviceId,
  );

  return (
    matchedRules.length > 0 &&
    matchedRules.every((rule) => rule.autoSendAllowed)
  );
}

function matchedAvailabilityAutoSendAllowed(
  matchedRule: MatchedAvailabilityRule | null,
  rules: ClientRules,
): boolean {
  if (!matchedRule) {
    return true;
  }

  const sourceRule = rules.availabilityRules.find(
    (rule) => rule.id === matchedRule.id,
  );
  return sourceRule?.autoSendAllowed ?? false;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cityMatches(ruleLocation: string, city: string | null): boolean {
  if (!city) {
    return false;
  }

  const normalizedRuleLocation = normalize(ruleLocation);
  const normalizedCity = normalize(city);
  const genitiveLocation = toLithuanianGenitive(normalizedRuleLocation);

  return (
    normalizedCity === normalizedRuleLocation ||
    normalizedCity.includes(normalizedRuleLocation) ||
    normalizedCity.includes(genitiveLocation)
  );
}

function toLithuanianGenitive(location: string): string {
  if (location === "vilnius") {
    return "vilniaus";
  }

  if (location.endsWith("as")) {
    return `${location.slice(0, -2)}o`;
  }

  if (location.endsWith("a")) {
    return `${location.slice(0, -1)}os`;
  }

  return location;
}
