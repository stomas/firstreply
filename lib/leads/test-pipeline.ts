import {
  assertAiGapFillerConfigured,
  fillAiGaps,
  needsAiGapFiller,
} from "@/lib/ai/gap-filler";
import { AppConfigError } from "@/lib/app-errors";
import { decideLeadResponse } from "@/lib/decision/engine";
import {
  classifyParsedLeadService,
  parseTestInquiryLead,
  resolveParsedLeadRequirements,
  toDecisionEngineInput,
  type ParsedLeadData,
} from "@/lib/leads/parse-lead";
import type { TestInquiryInput } from "@/lib/leads/test-inquiry-schema";
import {
  composeResponseDraft,
  type ComposedResponseDraft,
} from "@/lib/response/composer";
import type {
  ClientRules,
  DecisionResult,
  LeadEvaluationResult,
  MatchedPricingRule,
  ResponseType,
} from "@/lib/rules/types";

export type TraceStageStatus = "ok" | "skipped" | "manual_review";

export type LeadProcessingTraceStage = {
  key:
    | "parse"
    | "service_classification"
    | "resolver_pass_1"
    | "ai_gap_filler"
    | "resolver_pass_2"
    | "decision"
    | "composer";
  label: string;
  status: TraceStageStatus;
  summary: string;
  data: Record<string, unknown>;
};

export type LeadProcessingTrace = {
  stages: LeadProcessingTraceStage[];
};

export type TestLeadPipelineResult = {
  parsedLead: ParsedLeadData;
  decisionResult: DecisionResult;
  composed: ComposedResponseDraft | null;
  responseStatus: "ready" | "manual_review";
  responseType: ComposedResponseDraft["responseType"];
  draftText: string | null;
  autoSendAllowed: boolean;
  manualReviewReason: string | null;
  evaluation: LeadEvaluationResult;
  trace: LeadProcessingTrace;
};

type RunTestLeadPipelineInput = {
  input: TestInquiryInput;
  rules: ClientRules;
  leadId: string;
  isTest: boolean;
  aiOptions?: Parameters<typeof fillAiGaps>[1];
};

export async function runTestLeadPipeline({
  input,
  rules,
  leadId,
  isTest,
  aiOptions = {},
}: RunTestLeadPipelineInput): Promise<TestLeadPipelineResult> {
  const trace: LeadProcessingTrace = { stages: [] };
  let parsedLead = parseTestInquiryLead(input);

  trace.stages.push({
    key: "parse",
    label: "Parse",
    status: "ok",
    summary: `${parsedLead.facts.length} faktai, ${parsedLead.location ? "vieta rasta" : "vieta nerasta"}`,
    data: {
      serviceId: parsedLead.serviceId,
      city: parsedLead.city,
      location: parsedLead.location,
      intents: {
        asksPrice: parsedLead.asksPrice,
        asksAvailability: parsedLead.asksAvailability,
        isUrgent: parsedLead.isUrgent,
      },
      facts: parsedLead.facts,
    },
  });

  parsedLead = classifyParsedLeadService(
    parsedLead,
    input.inquiryMessage,
    rules,
  );
  trace.stages.push({
    key: "service_classification",
    label: "Service classification",
    status: parsedLead.serviceId ? "ok" : "manual_review",
    summary: parsedLead.serviceId
      ? `Paslauga nustatyta: ${parsedLead.serviceId}`
      : "Paslauga nenustatyta arba dviprasmiška",
    data: parsedLead.serviceClassification
      ? {
          id: parsedLead.serviceClassification.id,
          confidence: parsedLead.serviceClassification.confidence,
          source: parsedLead.serviceClassification.source,
          reason: parsedLead.serviceClassification.reason,
          candidates: parsedLead.serviceClassification.candidates,
        }
      : {},
  });

  parsedLead = resolveParsedLeadRequirements(parsedLead, rules);
  trace.stages.push(resolverTraceStage("resolver_pass_1", parsedLead));

  if (needsAiGapFiller(parsedLead)) {
    try {
      assertAiGapFillerConfigured(parsedLead, aiOptions.env);
    } catch (error) {
      if (error instanceof AppConfigError) {
        trace.stages.push({
          key: "ai_gap_filler",
          label: "AI gap filler",
          status: "manual_review",
          summary: error.message,
          data: {
            error: error.message,
            unresolvedRequirements: parsedLead.unresolvedRequirements,
          },
        });
        attachTrace(error, trace);
      }

      throw error;
    }

    const aiGapFill = await fillAiGaps(
      {
        rawText: input.inquiryMessage,
        facts: parsedLead.facts,
        requirements: rules.decisionRequirements.filter(
          (requirement) =>
            requirement.active &&
            requirement.serviceId === parsedLead.serviceId,
        ),
        resolution: parsedLead,
        subjects: (rules.serviceSubjects ?? []).filter(
          (subject) => subject.serviceId === parsedLead.serviceId,
        ),
      },
      aiOptions,
    );

    if (aiGapFill.status === "manual_review") {
      trace.stages.push({
        key: "ai_gap_filler",
        label: "AI gap filler",
        status: "manual_review",
        summary: aiGapFill.reason,
        data: {
          reason: aiGapFill.reason,
          rawResponseCount: aiGapFill.rawResponses.length,
        },
      });

      const decisionResult = manualReviewDecision(aiGapFill.reason);

      return {
        parsedLead,
        decisionResult,
        composed: null,
        responseStatus: "manual_review",
        responseType: "manual_review",
        draftText: null,
        autoSendAllowed: false,
        manualReviewReason: aiGapFill.reason,
        evaluation: manualReviewEvaluation({
          leadId,
          serviceId: parsedLead.serviceId,
          reason: aiGapFill.reason,
        }),
        trace,
      };
    }

    trace.stages.push({
      key: "ai_gap_filler",
      label: "AI gap filler",
      status: "ok",
      summary: `${aiGapFill.rejectedFindings.length} atmesti AI radiniai`,
      data: {
        rawResponseCount: aiGapFill.rawResponses.length,
        rejectedFindings: aiGapFill.rejectedFindings,
      },
    });

    parsedLead = {
      ...parsedLead,
      facts: aiGapFill.facts,
      resolvedRequirements: aiGapFill.resolution.resolvedRequirements,
      unresolvedRequirements: aiGapFill.resolution.unresolvedRequirements,
      conflicts: aiGapFill.resolution.conflicts,
    };
    trace.stages.push(resolverTraceStage("resolver_pass_2", parsedLead));
  } else {
    trace.stages.push({
      key: "ai_gap_filler",
      label: "AI gap filler",
      status: "skipped",
      summary: "AI nereikalingas: visi privalomi reikalavimai išspręsti",
      data: {},
    });
  }

  const decisionResult = decideLeadResponse(
    toDecisionEngineInput({ parsed: parsedLead, rules }),
  );
  trace.stages.push({
    key: "decision",
    label: "Decision",
    status: "ok",
    summary: decisionResult.reason,
    data: decisionResult as unknown as Record<string, unknown>,
  });

  const composed = composeResponseDraft({
    decisionResult,
    rules,
    resolvedRequirements: parsedLead.resolvedRequirements,
    isTest,
  });
  trace.stages.push({
    key: "composer",
    label: "Composer",
    status: "ok",
    summary: composed.responseType,
    data: {
      responseType: composed.responseType,
      autoSendAllowed: composed.autoSendAllowed,
      autoSendBlockedBy: composed.autoSendBlockedBy,
      manualReviewReason: composed.manualReviewReason,
      draftText: composed.draftText,
    },
  });

  const responseStatus = composed.draftText ? "ready" : "manual_review";

  return {
    parsedLead,
    decisionResult,
    composed,
    responseStatus,
    responseType: composed.responseType,
    draftText: composed.draftText,
    autoSendAllowed: composed.autoSendAllowed,
    manualReviewReason: composed.manualReviewReason,
    evaluation: toLeadEvaluationResult({
      leadId,
      serviceId: parsedLead.serviceId,
      decisionResult,
      composed,
      rules,
      parsedLead,
    }),
    trace,
  };
}

function attachTrace(error: AppConfigError, trace: LeadProcessingTrace): void {
  (error as AppConfigError & { trace?: LeadProcessingTrace }).trace = trace;
}

function resolverTraceStage(
  key: "resolver_pass_1" | "resolver_pass_2",
  parsedLead: ParsedLeadData,
): LeadProcessingTraceStage {
  const resolvedCount = Object.values(parsedLead.resolvedRequirements).filter(
    Boolean,
  ).length;

  return {
    key,
    label: key === "resolver_pass_1" ? "Resolver pass 1" : "Resolver pass 2",
    status: "ok",
    summary: `${resolvedCount} resolved, ${parsedLead.unresolvedRequirements.length} unresolved, ${parsedLead.conflicts.length} conflicts`,
    data: {
      resolvedRequirements: parsedLead.resolvedRequirements,
      unresolvedRequirements: parsedLead.unresolvedRequirements,
      conflicts: parsedLead.conflicts,
    },
  };
}

function manualReviewDecision(reason: "AI_PARSE_FAILED"): DecisionResult {
  return {
    decision: "MANUAL_REVIEW",
    reason,
    priceEstimate: null,
    leadTime: null,
    questionsToAsk: [],
    autoSend: false,
    autoSendBlockedBy: [reason],
  };
}

function manualReviewEvaluation(params: {
  leadId: string;
  serviceId: string | null;
  reason: string;
}): LeadEvaluationResult {
  return {
    leadId: params.leadId,
    serviceId: params.serviceId,
    canGenerateResponse: false,
    autoSendAllowed: false,
    responseType: "manual_review",
    missingRequirements: [],
    matchedPricingRules: [],
    matchedAvailabilityRule: null,
    manualReviewReasons: [params.reason],
    draftText: null,
  };
}

function toLeadEvaluationResult(params: {
  leadId: string;
  serviceId: string | null;
  decisionResult: DecisionResult;
  composed: ComposedResponseDraft;
  rules: ClientRules;
  parsedLead: ParsedLeadData;
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
  responseType: ComposedResponseDraft["responseType"],
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
  rules: ClientRules,
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
