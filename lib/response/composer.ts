import { AppConfigError } from "@/lib/app-errors";
import type {
  ClientRules,
  DecisionResult,
  ResolvedRequirementValue,
} from "@/lib/rules/types";

export type ComposedResponseDraft = {
  responseType:
    | "missing_info"
    | "price_estimate"
    | "decline"
    | "offering_answer"
    | "manual_review";
  draftText: string | null;
  autoSendAllowed: boolean;
  autoSendBlockedBy: string[];
  manualReviewReason: string | null;
};

type ComposeResponseInput = {
  decisionResult: DecisionResult;
  rules: ClientRules;
  resolvedRequirements: Record<string, ResolvedRequirementValue | null>;
  isTest: boolean;
};

export function composeResponseDraft({
  decisionResult,
  rules,
  resolvedRequirements,
  isTest,
}: ComposeResponseInput): ComposedResponseDraft {
  const responseType = responseTypeForDecision(decisionResult.decision);
  const templateKey = templateKeyForDecision(decisionResult.decision);
  const templateValues = {
    questions: decisionResult.questionsToAsk.join(" "),
    priceAmount: formatNumber(decisionResult.priceEstimate?.amount),
    currency: decisionResult.priceEstimate?.currency ?? "",
    leadTimeWeeks: decisionResult.leadTime?.text ?? "",
    offeringDescription: decisionResult.offeringAnswer?.description ?? "",
    offeringFollowup: decisionResult.offeringAnswer?.followup ?? "",
  };
  const draftText = templateKey
    ? renderTemplate(
        prepareTemplate(findTemplate(rules, templateKey), templateValues),
        templateValues,
      )
    : (decisionResult.manualReviewDraftText ?? null);
  const autoSendBlockedBy = autoSendBlockers({
    decisionResult,
    rules,
    resolvedRequirements,
    isTest,
  });

  return {
    responseType,
    draftText,
    autoSendAllowed:
      decisionResult.autoSend && autoSendBlockedBy.length === 0 && !!draftText,
    autoSendBlockedBy,
    manualReviewReason:
      autoSendBlockedBy.length > 0 ? autoSendBlockedBy.join("; ") : null,
  };
}

function responseTypeForDecision(
  decision: DecisionResult["decision"],
): ComposedResponseDraft["responseType"] {
  if (decision === "ASK_MISSING_INFO") {
    return "missing_info";
  }

  if (decision === "PRICE_ESTIMATE") {
    return "price_estimate";
  }

  if (decision === "DECLINE_TEMPLATE") {
    return "decline";
  }

  if (decision === "OFFERING_ANSWER") {
    return "offering_answer";
  }

  return "manual_review";
}

function templateKeyForDecision(
  decision: DecisionResult["decision"],
): string | null {
  if (decision === "ASK_MISSING_INFO") {
    return "ask_missing_info";
  }

  if (decision === "PRICE_ESTIMATE") {
    return "price_estimate";
  }

  if (decision === "DECLINE_TEMPLATE") {
    return "decline_location";
  }

  if (decision === "OFFERING_ANSWER") {
    return "offering_answer";
  }

  return null;
}

function findTemplate(rules: ClientRules, templateKey: string): string {
  const template = (rules.responseTemplates ?? []).find(
    (candidate) => candidate.active && candidate.templateKey === templateKey,
  );

  if (!template) {
    throw new AppConfigError(`Response template not found: ${templateKey}`);
  }

  return template.body;
}

function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_, key) => {
    return values[key] ?? "";
  });
}

function prepareTemplate(
  template: string,
  values: Record<string, string>,
): string {
  if (values.leadTimeWeeks.trim()) {
    return template;
  }

  return removePlaceholderSentences(template, "leadTimeWeeks");
}

function removePlaceholderSentences(
  template: string,
  placeholder: string,
): string {
  const pattern = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, "iu");
  const parts = template.split(/(?<=[.!?])\s+|\n+/u);
  const withoutPlaceholderSentences = parts
    .filter((part) => !pattern.test(part))
    .join(" ")
    .trim();

  return withoutPlaceholderSentences || template.replace(pattern, "").trim();
}

function autoSendBlockers({
  decisionResult,
  rules,
  resolvedRequirements,
  isTest,
}: ComposeResponseInput): string[] {
  const blockers = [...decisionResult.autoSendBlockedBy];

  if (isTest) {
    blockers.push("TEST_LEAD");
  }

  const policy = asRecord(rules.autosendPolicies?.[0]?.policy);
  if (policy && policy.enabled !== true) {
    blockers.push("AUTOSEND_POLICY_DISABLED");
  }

  if (decisionResult.decision !== "PRICE_ESTIMATE") {
    return unique(blockers);
  }

  for (const requirementKey of priceAffectingRequirementKeys(
    decisionResult,
    rules,
  )) {
    const requirement = resolvedRequirements[requirementKey];
    if (!requirement) {
      blockers.push(`PRICE_REQUIREMENT_UNRESOLVED:${requirementKey}`);
      continue;
    }

    blockers.push(
      ...priceRequirementBlockers(requirementKey, requirement, policy),
    );
  }

  return unique(blockers);
}

function priceAffectingRequirementKeys(
  decisionResult: DecisionResult,
  rules: ClientRules,
): string[] {
  const pricingRuleId = decisionResult.priceEstimate?.pricingRuleId;
  const pricingRule = rules.pricingRules.find(
    (rule) => rule.id === pricingRuleId,
  );
  const rule = asRecord(pricingRule?.rule);
  const requiredByPricing = Array.isArray(rule?.requires)
    ? rule.requires.filter((key): key is string => typeof key === "string")
    : [];

  if (requiredByPricing.length > 0) {
    return requiredByPricing;
  }

  return rules.decisionRequirements
    .filter((requirement) => requirement.affectsPrice)
    .map((requirement) => requirement.requirementKey);
}

function priceRequirementBlockers(
  requirementKey: string,
  requirement: ResolvedRequirementValue,
  policy: Record<string, unknown> | null,
): string[] {
  const blockers: string[] = [];
  const pricePolicy = asRecord(policy?.priceAffectingRequirements);
  const allowSources = Array.isArray(pricePolicy?.allowSources)
    ? pricePolicy.allowSources.filter(
        (source): source is string => typeof source === "string",
      )
    : ["deterministic", "form_field"];
  const aiAllowedIf = asRecord(pricePolicy?.aiAllowedIf);
  const aiMinConfidence =
    typeof aiAllowedIf?.minConfidence === "number"
      ? aiAllowedIf.minConfidence
      : 1;

  if (requirement.source === "ai") {
    if (
      aiAllowedIf?.evidenceVerified === true &&
      requirement.evidenceVerified !== true
    ) {
      blockers.push(`PRICE_REQUIREMENT_EVIDENCE_BLOCKED:${requirementKey}`);
    }

    if (requirement.confidence < aiMinConfidence) {
      blockers.push(`PRICE_REQUIREMENT_CONFIDENCE_BLOCKED:${requirementKey}`);
    }

    if (
      aiAllowedIf?.validationPassed === true &&
      requirement.validationPassed !== true
    ) {
      blockers.push(`PRICE_REQUIREMENT_VALIDATION_BLOCKED:${requirementKey}`);
    }

    if (blockers.length === 0) {
      return blockers;
    }
  }

  if (!allowSources.includes(requirement.source)) {
    blockers.unshift(`PRICE_REQUIREMENT_SOURCE_BLOCKED:${requirementKey}`);
  }

  return blockers;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
