import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import { extractDeterministicFacts } from "@/lib/extractor/deterministic";
import type {
  AdminUnitLocation,
  ExtractedContacts,
  ExtractedFact,
} from "@/lib/extractor/types";
import { resolveRequirements } from "@/lib/requirements/resolve-requirements";
import type {
  ClientRules,
  DecisionEngineInput,
  EvaluationLead,
  RequirementResolutionResult,
} from "@/lib/rules/types";

export type ParsedLeadData = {
  schemaVersion: "lead_parse_v2";
  serviceId: string;
  city: string | null;
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
  hasAttachments: boolean;
  source: "dashboard_test_form";
  parserVersion: string;
  contacts: ExtractedContacts;
  location: AdminUnitLocation | null;
  facts: ExtractedFact[];
  resolvedRequirements: RequirementResolutionResult["resolvedRequirements"];
  unresolvedRequirements: RequirementResolutionResult["unresolvedRequirements"];
  conflicts: RequirementResolutionResult["conflicts"];
};

export function parseTestInquiryLead(input: TestInquiryInput): ParsedLeadData {
  const extraction = extractDeterministicFacts(input.inquiryMessage);

  return {
    schemaVersion: "lead_parse_v2",
    serviceId: input.serviceId,
    city:
      normalizeOptional(input.city) ??
      extraction.location?.adminUnit.label ??
      null,
    asksPrice: input.asksPrice || extraction.intents.asksPrice,
    asksAvailability:
      input.asksAvailability || extraction.intents.asksAvailability,
    isUrgent: input.isUrgent || extraction.intents.isUrgent,
    hasAttachments: false,
    source: "dashboard_test_form",
    parserVersion: extraction.meta.parserVersion,
    contacts: extraction.contacts,
    location: extraction.location,
    facts: extraction.facts,
    resolvedRequirements: {},
    unresolvedRequirements: [],
    conflicts: [],
  };
}

export function resolveParsedLeadRequirements(
  parsed: ParsedLeadData,
  rules: ClientRules,
): ParsedLeadData {
  const resolution = resolveRequirements({
    facts: parsed.facts,
    requirements: rules.decisionRequirements.filter(
      (requirement) =>
        requirement.active && requirement.serviceId === parsed.serviceId,
    ),
  });

  return {
    ...parsed,
    ...resolution,
  };
}

export function toEvaluationLead(params: {
  leadId: string;
  input: TestInquiryInput;
  parsed: ParsedLeadData;
}): EvaluationLead {
  return {
    id: params.leadId,
    serviceId: params.parsed.serviceId,
    city: params.parsed.city,
    originalMessage: params.input.inquiryMessage,
    parseResult: params.parsed,
    asksPrice: params.parsed.asksPrice,
    asksAvailability: params.parsed.asksAvailability,
    isUrgent: params.parsed.isUrgent,
    hasAttachments: params.parsed.hasAttachments,
  };
}

export function toDecisionEngineInput(params: {
  parsed: ParsedLeadData;
  rules: ClientRules;
}): DecisionEngineInput {
  return {
    service: {
      id: params.parsed.serviceId,
      confidence: 1,
      candidates: [{ id: params.parsed.serviceId, confidence: 1 }],
    },
    location: params.parsed.location,
    intents: {
      asksPrice: params.parsed.asksPrice,
      asksAvailability: params.parsed.asksAvailability,
      isUrgent: params.parsed.isUrgent,
    },
    resolvedRequirements: params.parsed.resolvedRequirements,
    unresolvedRequirements: params.parsed.unresolvedRequirements,
    conflicts: params.parsed.conflicts,
    rules: params.rules,
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
