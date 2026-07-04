import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import type { EvaluationLead } from "@/lib/rules/types";

export type ParsedLeadData = {
  serviceId: string;
  city: string | null;
  fence_length_m?: number;
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
  hasAttachments: boolean;
  source: "dashboard_test_form";
};

export function parseTestInquiryLead(input: TestInquiryInput): ParsedLeadData {
  const fenceLengthM = extractFenceLengthM(input.inquiryMessage);

  return {
    serviceId: input.serviceId,
    city: normalizeOptional(input.city),
    ...(fenceLengthM === null ? {} : { fence_length_m: fenceLengthM }),
    asksPrice: input.asksPrice,
    asksAvailability: input.asksAvailability,
    isUrgent: input.isUrgent,
    hasAttachments: false,
    source: "dashboard_test_form",
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
    parsedJson: params.parsed,
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

function extractFenceLengthM(message: string): number | null {
  const normalized = message.toLocaleLowerCase("lt-LT");
  const contextualMatch = normalized.match(
    /(?:tvoros|tvora|ilgis|ilgio|reikia|reiktu|reiktų)[^\d]{0,40}(\d+(?:[,.]\d+)?)\s*(?:m|metrai|metrų|metru|metrus)\b/,
  );
  const fallbackMatch = normalized.match(
    /(\d+(?:[,.]\d+)?)\s*(?:m|metrai|metrų|metru|metrus)\b/,
  );
  const rawValue = contextualMatch?.[1] ?? fallbackMatch?.[1];

  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
