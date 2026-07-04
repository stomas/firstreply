import type { Prisma } from "@prisma/client";
import { AppConfigError, AppValidationError } from "@/lib/app-errors";
import {
  AI_NOT_CONFIGURED,
  assertAiGapFillerConfigured,
} from "@/lib/ai/gap-filler";
import { generateLeadResponse } from "@/lib/ai/generate-lead-response";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import {
  parseTestInquiryLead,
  resolveParsedLeadRequirements,
  toEvaluationLead,
} from "@/lib/leads/parse-lead";
import {
  fieldErrors,
  testInquirySchema,
  type TestInquiryInput,
} from "@/lib/leads/test-inquiry-schema";
import { evaluateLeadForResponse } from "@/lib/rules/evaluate-lead-for-response";
import { getClientRules } from "@/lib/rules/get-client-rules";
import type { LeadEvaluationResult } from "@/lib/rules/types";

export type TestLeadResult = {
  leadId: string;
  responseId: string;
  responseStatus: "ready" | "manual_review";
  evaluation: LeadEvaluationResult;
};

export async function createTestLeadAndResponse(
  clientId: string,
  rawInput: unknown,
): Promise<TestLeadResult> {
  assertDatabaseConfigured();

  const parsedInput = testInquirySchema.safeParse(rawInput);
  if (!parsedInput.success) {
    throw new AppValidationError(
      "Patikrinkite testavimo formos laukus.",
      fieldErrors(parsedInput.error),
    );
  }

  const input = parsedInput.data;
  const rules = await getClientRules(clientId);
  ensureTestingAllowed(rules, input);

  const parsedLead = resolveParsedLeadRequirements(
    parseTestInquiryLead(input),
    rules,
  );
  const lead = await prisma.lead.create({
    data: {
      clientId,
      serviceId: parsedLead.serviceId,
      sourceType: "test",
      isTest: true,
      status: "testing",
      customerName: emptyToNull(input.customerName),
      customerEmail: emptyToNull(input.customerEmail),
      customerPhone: emptyToNull(input.customerPhone),
      city: parsedLead.city,
      originalMessage: input.inquiryMessage,
      rawText: input.inquiryMessage,
      source: "test_tool",
      parseResult: parsedLead as Prisma.InputJsonObject,
      asksPrice: parsedLead.asksPrice,
      asksAvailability: parsedLead.asksAvailability,
      isUrgent: parsedLead.isUrgent,
      hasAttachments: parsedLead.hasAttachments,
    },
  });

  try {
    assertAiGapFillerConfigured(parsedLead);
  } catch (error) {
    if (error instanceof AppConfigError) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: "error",
          errorCode: AI_NOT_CONFIGURED,
          manualReviewReason: error.message,
        },
      });
    }

    throw error;
  }

  const evaluation = await evaluateLeadForResponse(
    toEvaluationLead({
      leadId: lead.id,
      input,
      parsed: parsedLead,
    }),
    rules,
    {
      generateDraft: generateLeadResponse,
    },
  );

  const responseStatus =
    evaluation.canGenerateResponse && evaluation.draftText
      ? "ready"
      : "manual_review";
  const manualReviewReason = evaluation.manualReviewReasons.join("; ") || null;

  const response = await prisma.leadResponse.create({
    data: {
      leadId: lead.id,
      responseType: evaluation.responseType,
      draftText: evaluation.draftText,
      status: responseStatus,
      autoSendAllowed:
        responseStatus === "ready" ? evaluation.autoSendAllowed : false,
      manualReviewReason,
      decisionJson: evaluation as unknown as Prisma.InputJsonObject,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: responseStatus === "ready" ? "response_ready" : "manual_review",
      manualReviewReason,
    },
  });

  return {
    leadId: lead.id,
    responseId: response.id,
    responseStatus,
    evaluation,
  };
}

function ensureTestingAllowed(
  rules: Awaited<ReturnType<typeof getClientRules>>,
  input: TestInquiryInput,
) {
  const hasRules =
    rules.pricingRules.length +
      rules.decisionRequirements.length +
      rules.availabilityRules.length >
    0;

  if (rules.services.length === 0 || !hasRules) {
    throw new AppValidationError(
      "Šiam klientui dar nėra suvestų taisyklių. Testavimas negalimas, kol nėra bent vienos aktyvios paslaugos ir taisyklių.",
    );
  }

  const serviceExists = rules.services.some(
    (service) => service.id === input.serviceId && service.active,
  );

  if (!serviceExists) {
    throw new AppValidationError(
      "Pasirinkta paslauga neaktyvi arba neegzistuoja.",
    );
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
