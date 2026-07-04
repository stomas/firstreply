import type { Prisma } from "@prisma/client";
import { AppConfigError, AppValidationError } from "@/lib/app-errors";
import {
  AI_NOT_CONFIGURED,
  assertAiGapFillerConfigured,
  fillAiGaps,
} from "@/lib/ai/gap-filler";
import { decideLeadResponse } from "@/lib/decision/engine";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import {
  parseTestInquiryLead,
  toDecisionEngineInput,
  resolveParsedLeadRequirements,
} from "@/lib/leads/parse-lead";
import { composeResponseDraft } from "@/lib/response/composer";
import {
  fieldErrors,
  testInquirySchema,
  type TestInquiryInput,
} from "@/lib/leads/test-inquiry-schema";
import { getClientRules } from "@/lib/rules/get-client-rules";
import type {
  DecisionResult,
  LeadEvaluationResult,
  MatchedPricingRule,
  ResponseType,
} from "@/lib/rules/types";

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

  let parsedLead = resolveParsedLeadRequirements(
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

  const aiGapFill = await fillAiGaps(
    {
      rawText: input.inquiryMessage,
      facts: parsedLead.facts,
      requirements: rules.decisionRequirements.filter(
        (requirement) =>
          requirement.active && requirement.serviceId === parsedLead.serviceId,
      ),
      resolution: parsedLead,
      subjects: (rules.serviceSubjects ?? []).filter(
        (subject) => subject.serviceId === parsedLead.serviceId,
      ),
    },
    {},
  );

  if (aiGapFill.status === "manual_review") {
    const decisionResult = {
      decision: "MANUAL_REVIEW",
      reason: aiGapFill.reason,
      priceEstimate: null,
      leadTime: null,
      questionsToAsk: [],
      autoSend: false,
      autoSendBlockedBy: [aiGapFill.reason],
    };
    const response = await prisma.leadResponse.create({
      data: {
        leadId: lead.id,
        responseType: "manual_review",
        draftText: null,
        status: "manual_review",
        autoSendAllowed: false,
        manualReviewReason: aiGapFill.reason,
        decisionJson: decisionResult as Prisma.InputJsonObject,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "manual_review",
        manualReviewReason: aiGapFill.reason,
        decisionResult: decisionResult as Prisma.InputJsonObject,
      },
    });

    return {
      leadId: lead.id,
      responseId: response.id,
      responseStatus: "manual_review",
      evaluation: {
        leadId: lead.id,
        serviceId: parsedLead.serviceId,
        canGenerateResponse: false,
        autoSendAllowed: false,
        responseType: "manual_review",
        missingRequirements: [],
        matchedPricingRules: [],
        matchedAvailabilityRule: null,
        manualReviewReasons: [aiGapFill.reason],
        draftText: null,
      },
    };
  }

  parsedLead = {
    ...parsedLead,
    facts: aiGapFill.facts,
    resolvedRequirements: aiGapFill.resolution.resolvedRequirements,
    unresolvedRequirements: aiGapFill.resolution.unresolvedRequirements,
    conflicts: aiGapFill.resolution.conflicts,
  };

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      parseResult: parsedLead as Prisma.InputJsonObject,
    },
  });

  const decisionResult = decideLeadResponse(
    toDecisionEngineInput({ parsed: parsedLead, rules }),
  );

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      decisionResult: decisionResult as unknown as Prisma.InputJsonObject,
    },
  });

  const composed = composeResponseDraft({
    decisionResult,
    rules,
    resolvedRequirements: parsedLead.resolvedRequirements,
    isTest: true,
  });
  const evaluation = toLeadEvaluationResult({
    leadId: lead.id,
    serviceId: parsedLead.serviceId,
    decisionResult,
    composed,
    rules,
    parsedLead,
  });
  const responseStatus = composed.draftText ? "ready" : "manual_review";
  const manualReviewReason = composed.manualReviewReason;

  const response = await prisma.leadResponse.create({
    data: {
      leadId: lead.id,
      responseType: composed.responseType,
      draftText: composed.draftText,
      status: responseStatus,
      autoSendAllowed: composed.autoSendAllowed,
      manualReviewReason,
      decisionJson: {
        decisionResult,
        composed,
      } as unknown as Prisma.InputJsonObject,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: responseStatus === "ready" ? "response_ready" : "manual_review",
      manualReviewReason,
      responseDraft: composed.draftText,
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

function toLeadEvaluationResult(params: {
  leadId: string;
  serviceId: string;
  decisionResult: DecisionResult;
  composed: ReturnType<typeof composeResponseDraft>;
  rules: Awaited<ReturnType<typeof getClientRules>>;
  parsedLead: ReturnType<typeof resolveParsedLeadRequirements>;
}): LeadEvaluationResult {
  return {
    leadId: params.leadId,
    serviceId: params.serviceId,
    canGenerateResponse: params.composed.draftText !== null,
    autoSendAllowed: params.composed.autoSendAllowed,
    responseType: legacyResponseType(params.composed.responseType),
    missingRequirements: params.parsedLead.unresolvedRequirements.map(
      (requirement) => ({
        key: requirement.requirementKey,
        label: requirement.label,
        question: requirement.question,
      }),
    ),
    matchedPricingRules: matchedPricingRules(
      params.decisionResult,
      params.rules,
    ),
    matchedAvailabilityRule: null,
    manualReviewReasons: params.composed.manualReviewReason
      ? [params.composed.manualReviewReason]
      : [],
    draftText: params.composed.draftText,
  };
}

function legacyResponseType(
  responseType: ReturnType<typeof composeResponseDraft>["responseType"],
): ResponseType {
  if (responseType === "missing_info") {
    return "missing_info";
  }

  if (responseType === "price_estimate") {
    return "price_availability";
  }

  return "manual_review";
}

function matchedPricingRules(
  decisionResult: DecisionResult,
  rules: Awaited<ReturnType<typeof getClientRules>>,
): MatchedPricingRule[] {
  const pricingRuleId = decisionResult.priceEstimate?.pricingRuleId;
  if (!pricingRuleId) {
    return [];
  }

  return rules.pricingRules
    .filter((rule) => rule.id === pricingRuleId)
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      priceMin: rule.priceMin,
      priceMax: rule.priceMax,
      unit: rule.unit,
    }));
}
