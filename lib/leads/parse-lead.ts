import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import { extractDeterministicFacts } from "@/lib/extractor/deterministic";
import type {
  AdminUnitLocation,
  ExtractedContacts,
  ExtractedFact,
  PrimaryIntent,
} from "@/lib/extractor/types";
import {
  classifyLeadServiceWithFallback,
  type ServiceAiOutcome,
  type ServiceClassification,
} from "@/lib/leads/service-classifier";
import type { AiEnvironment, AiModelCaller } from "@/lib/ai/openai-client";
import { resolveRequirements } from "@/lib/requirements/resolve-requirements";
import type {
  ClientRules,
  DecisionEngineInput,
  EvaluationLead,
  RequirementResolutionResult,
} from "@/lib/rules/types";

export type ParsedLeadData = {
  schemaVersion: "lead_parse_v2";
  serviceId: string | null;
  serviceClassification: ServiceClassification | null;
  city: string | null;
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
  primaryIntent: PrimaryIntent | null;
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
  const asksPrice = input.asksPrice || extraction.intents.asksPrice;

  return {
    schemaVersion: "lead_parse_v2",
    serviceId: normalizeOptional(input.serviceId),
    serviceClassification: null,
    city:
      normalizeOptional(input.city) ??
      extraction.location?.adminUnit.label ??
      null,
    asksPrice,
    asksAvailability:
      input.asksAvailability || extraction.intents.asksAvailability,
    isUrgent: input.isUrgent || extraction.intents.isUrgent,
    // „Kaina pirma": jei formos laukas nurodo kainos klausimą, jis turi
    // pirmenybę prieš tekste rastą offering intentą.
    primaryIntent:
      asksPrice && extraction.intents.primaryIntent === "asks_offering"
        ? "requests_quote"
        : extraction.intents.primaryIntent,
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

export async function classifyParsedLeadService(
  parsed: ParsedLeadData,
  message: string,
  rules: ClientRules,
  aiOptions: { env?: AiEnvironment; callModel?: AiModelCaller } = {},
): Promise<{ parsed: ParsedLeadData; ai: ServiceAiOutcome }> {
  const { classification, ai } = await classifyLeadServiceWithFallback(
    { requestedServiceId: parsed.serviceId, message, rules },
    aiOptions,
  );

  return {
    parsed: {
      ...parsed,
      serviceId: classification.id,
      serviceClassification: classification,
    },
    ai,
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
  const serviceClassification = params.parsed.serviceClassification;

  return {
    service: {
      id: params.parsed.serviceId,
      confidence: serviceClassification?.confidence ?? 0,
      source: serviceClassification?.source,
      evidence: serviceClassification?.evidence ?? null,
      evidenceVerified: serviceClassification?.evidenceVerified,
      candidates: serviceClassification?.candidates.map((candidate) => ({
        id: candidate.id,
        confidence: candidate.confidence,
      })),
    },
    location: params.parsed.location,
    city: params.parsed.city,
    intents: {
      asksPrice: params.parsed.asksPrice,
      asksAvailability: params.parsed.asksAvailability,
      isUrgent: params.parsed.isUrgent,
      primaryIntent: params.parsed.primaryIntent ?? "other",
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
