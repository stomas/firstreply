import type { Prisma } from "@prisma/client";
import { AppConfigError, AppValidationError } from "@/lib/app-errors";
import { AI_NOT_CONFIGURED } from "@/lib/ai/gap-filler";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import {
  parseTestInquiryLead,
  resolveParsedLeadRequirements,
} from "@/lib/leads/parse-lead";
import {
  runTestLeadPipeline,
  type LeadProcessingTrace,
} from "@/lib/leads/test-pipeline";
import {
  fieldErrors,
  testInquirySchema,
  type TestInquiryInput,
} from "@/lib/leads/test-inquiry-schema";
import { getClientRules } from "@/lib/rules/get-client-rules";
import type { LeadEvaluationResult } from "@/lib/rules/types";

export type TestLeadResult = {
  leadId: string;
  responseId: string;
  responseStatus: "ready" | "manual_review";
  evaluation: LeadEvaluationResult;
  trace: LeadProcessingTrace;
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

  const pipeline = await runTestLeadPipeline({
    input,
    rules,
    leadId: lead.id,
    isTest: true,
  }).catch(async (error) => {
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
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      parseResult: pipeline.parsedLead as Prisma.InputJsonObject,
      decisionResult:
        pipeline.decisionResult as unknown as Prisma.InputJsonObject,
    },
  });

  const response = await prisma.leadResponse.create({
    data: {
      leadId: lead.id,
      responseType: pipeline.responseType,
      draftText: pipeline.draftText,
      status: pipeline.responseStatus,
      autoSendAllowed: pipeline.autoSendAllowed,
      manualReviewReason: pipeline.manualReviewReason,
      decisionJson: {
        decisionResult: pipeline.decisionResult,
        composed: pipeline.composed,
        trace: pipeline.trace,
      } as unknown as Prisma.InputJsonObject,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status:
        pipeline.responseStatus === "ready"
          ? "response_ready"
          : "manual_review",
      manualReviewReason: pipeline.manualReviewReason,
      responseDraft: pipeline.draftText,
    },
  });

  return {
    leadId: lead.id,
    responseId: response.id,
    responseStatus: pipeline.responseStatus,
    evaluation: pipeline.evaluation,
    trace: pipeline.trace,
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
