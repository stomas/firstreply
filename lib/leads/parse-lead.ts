import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import { extractDeterministicFacts } from "@/lib/extractor/deterministic";
import type {
  AdminUnitLocation,
  ExtractedContacts,
  ExtractedFact,
} from "@/lib/extractor/types";
import type { EvaluationLead } from "@/lib/rules/types";

export type ParsedLeadData = {
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
};

export function parseTestInquiryLead(input: TestInquiryInput): ParsedLeadData {
  const extraction = extractDeterministicFacts(input.inquiryMessage);

  return {
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

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
