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
import {
  isLlmFirstParseEnabled,
  parseTestInquiryLeadLlmFirst,
  type LlmFirstParseResult,
} from "@/lib/leads/llm-first-parse";
import type {
  LeadProcessingInput,
  TestInquiryInput,
} from "@/lib/leads/test-inquiry-schema";
import {
  isShadowEnabled,
  runShadowParse,
  type ShadowDiff,
  type ShadowParseResult,
} from "@/lib/ai/shadow-parse";
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

export type TraceStageStatus = "ok" | "skipped" | "manual_review" | "rejected";

export type LeadProcessingTraceStage = {
  key:
    | "parse"
    | "service_classification"
    | "ai_service_classification"
    | "resolver_pass_1"
    | "ai_gap_filler"
    | "resolver_pass_2"
    | "decision"
    | "composer"
    | "shadow_parse";
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
  shadowParseResult?: ShadowParseResult;
  shadowDiff?: ShadowDiff;
};

type RunLeadPipelineInput = {
  input: LeadProcessingInput;
  rules: ClientRules;
  leadId: string;
  isTest: boolean;
  aiOptions?: Parameters<typeof fillAiGaps>[1];
};

export async function runLeadPipeline({
  input,
  rules,
  leadId,
  isTest,
  aiOptions = {},
}: RunLeadPipelineInput): Promise<TestLeadPipelineResult> {
  const trace: LeadProcessingTrace = { stages: [] };
  const llmFirstEnabled = isLlmFirstParseEnabled(aiOptions.env ?? process.env);
  let llmFirstResult: LlmFirstParseResult | null = null;
  let parsedLead: ParsedLeadData;

  if (llmFirstEnabled) {
    llmFirstResult = await parseTestInquiryLeadLlmFirst(
      { input, rules },
      aiOptions,
    );
    parsedLead = llmFirstResult.parsed;
    trace.stages.push(llmFirstParseTraceStage(llmFirstResult));

    if (llmFirstResult.status === "manual_review") {
      return manualReviewPipelineResult({
        parsedLead,
        reason: llmFirstResult.reason,
        leadId,
        trace,
      });
    }
  } else {
    parsedLead = parseTestInquiryLead(input);
    trace.stages.push(parseTraceStage(parsedLead));
  }

  if (!llmFirstEnabled) {
    const serviceResult = await classifyParsedLeadService(
      parsedLead,
      input.inquiryMessage,
      rules,
      aiOptions,
    );
    parsedLead = serviceResult.parsed;
    trace.stages.push(serviceClassificationTraceStage(parsedLead));

    // AI fallback stage rodomas tik kai deterministika nepataikė ir buvo įeita į
    // AI kelią (skipped-not-configured / ok / rejected). Kai deterministika rado
    // paslaugą, stage nerodomas — trace seka nekinta esamiems srautams.
    if (serviceResult.ai.reason !== "DETERMINISTIC_MATCH") {
      const ai = serviceResult.ai;
      trace.stages.push({
        key: "ai_service_classification",
        label: "AI service classification",
        status: ai.status,
        summary:
          ai.status === "ok"
            ? `AI priskyrė paslaugą: ${ai.serviceId} (conf ${ai.confidence})`
            : ai.status === "skipped"
              ? `AI praleistas: ${ai.reason}`
              : `AI atmestas: ${ai.reason}`,
        data: {
          status: ai.status,
          reason: ai.reason,
          serviceId: ai.serviceId ?? null,
          confidence: ai.confidence ?? null,
          evidence: ai.evidence ?? null,
          rawResponseCount: ai.rawResponses?.length ?? 0,
          rawResponses: ai.rawResponses ?? [],
        },
      });
    }
  } else {
    trace.stages.push(serviceClassificationTraceStage(parsedLead));
  }

  parsedLead = resolveParsedLeadRequirements(parsedLead, rules);
  trace.stages.push(resolverTraceStage("resolver_pass_1", parsedLead));

  // Offering klausimas atsakomas TIK iš DB faktų (decision engine OFFERING_ANSWER),
  // todėl neišspręsti reikalavimai jo neblokuoja ir AI čia nekviečiamas.
  const skipAiForOffering = parsedLead.primaryIntent === "asks_offering";
  const skipAiForLlmFirst = llmFirstResult?.status === "ok";

  if (
    !skipAiForOffering &&
    !skipAiForLlmFirst &&
    needsAiGapFiller(parsedLead)
  ) {
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
      // Deterministika autoritetinga; AI primaryIntent naudojamas tik kai
      // deterministika nieko nepagavo.
      primaryIntent: parsedLead.primaryIntent ?? aiGapFill.primaryIntent,
    };
    trace.stages.push(resolverTraceStage("resolver_pass_2", parsedLead));
  } else {
    trace.stages.push({
      key: "ai_gap_filler",
      label: "AI gap filler",
      status: "skipped",
      summary: skipAiForLlmFirst
        ? "AI praleistas: LLM-first parse jau yra autoritetingas"
        : skipAiForOffering
          ? "AI praleistas: offering klausimas — reikalavimai neblokuoja"
          : "AI nereikalingas: visi privalomi reikalavimai išspręsti",
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

  // Shadow AI parse — TIK matavimui, rodomas tik kai flag įjungtas. Rezultatas
  // niekur nenaudojamas sprendimams; bet kokia klaida ignoruojama.
  let shadowParseResult: ShadowParseResult | undefined;
  let shadowDiff: ShadowDiff | undefined;
  const shadowEnv = aiOptions.env ?? process.env;
  if (isShadowEnabled(shadowEnv)) {
    try {
      const outcome = await runShadowParse(
        {
          rawText: input.inquiryMessage,
          requirements: rules.decisionRequirements.filter(
            (requirement) =>
              requirement.active &&
              requirement.serviceId === parsedLead.serviceId,
          ),
          subjects: (rules.serviceSubjects ?? []).filter(
            (subject) => subject.serviceId === parsedLead.serviceId,
          ),
          mainResolved: parsedLead.resolvedRequirements,
        },
        aiOptions,
      );

      if (outcome.status === "ok") {
        shadowParseResult = outcome.shadowParseResult;
        shadowDiff = outcome.shadowDiff;
      }

      trace.stages.push({
        key: "shadow_parse",
        label: "Shadow AI parse",
        status:
          outcome.status === "ok"
            ? "ok"
            : outcome.status === "skipped"
              ? "skipped"
              : "rejected",
        summary:
          outcome.status === "ok"
            ? `shadow — nenaudojama sprendimui; diff: ${Object.keys(outcome.shadowDiff).length} raktų`
            : `shadow — nenaudojama sprendimui; ${outcome.reason}`,
        data: {
          note: "shadow — nenaudojama sprendimui",
          status: outcome.status,
          reason: outcome.status === "ok" ? null : outcome.reason,
          shadowDiff: outcome.status === "ok" ? outcome.shadowDiff : null,
          shadowParseResult:
            outcome.status === "ok" ? outcome.shadowParseResult : null,
          rawResponses: "rawResponses" in outcome ? outcome.rawResponses : [],
        },
      });
    } catch (error) {
      trace.stages.push({
        key: "shadow_parse",
        label: "Shadow AI parse",
        status: "rejected",
        summary: "shadow — nenaudojama sprendimui; AI klaida (ignoruota)",
        data: {
          note: "shadow — nenaudojama sprendimui",
          status: "rejected",
          reason: "AI_ERROR",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

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
    shadowParseResult,
    shadowDiff,
  };
}

export function runTestLeadPipeline(input: {
  input: TestInquiryInput;
  rules: ClientRules;
  leadId: string;
  isTest: boolean;
  aiOptions?: Parameters<typeof fillAiGaps>[1];
}): Promise<TestLeadPipelineResult> {
  return runLeadPipeline(input);
}

function attachTrace(error: AppConfigError, trace: LeadProcessingTrace): void {
  (error as AppConfigError & { trace?: LeadProcessingTrace }).trace = trace;
}

function parseTraceStage(parsedLead: ParsedLeadData): LeadProcessingTraceStage {
  return {
    key: "parse",
    label: "Parse",
    status: "ok",
    summary: `${parsedLead.facts.length} faktai, ${parsedLead.location ? "vieta rasta" : "vieta nerasta"}`,
    data: {
      parserVersion: parsedLead.parserVersion,
      serviceId: parsedLead.serviceId,
      city: parsedLead.city,
      location: parsedLead.location,
      intents: {
        asksPrice: parsedLead.asksPrice,
        asksAvailability: parsedLead.asksAvailability,
        isUrgent: parsedLead.isUrgent,
      },
      facts: parsedLead.facts,
      reviewSignals: parsedLead.reviewSignals,
    },
  };
}

function llmFirstParseTraceStage(
  result: LlmFirstParseResult,
): LeadProcessingTraceStage {
  const parsedLead = result.parsed;

  return {
    key: "parse",
    label: "Parse",
    status: result.status === "ok" ? "ok" : "manual_review",
    summary:
      result.status === "ok"
        ? `LLM-first: ${parsedLead.facts.length} faktai, ${parsedLead.location ? "vieta rasta" : "vieta nerasta"}`
        : `LLM-first: ${result.reason}`,
    data: {
      parserVersion: parsedLead.parserVersion,
      mode: "llm_first",
      serviceId: parsedLead.serviceId,
      city: parsedLead.city,
      location: parsedLead.location,
      intents: {
        asksPrice: parsedLead.asksPrice,
        asksAvailability: parsedLead.asksAvailability,
        isUrgent: parsedLead.isUrgent,
      },
      facts: parsedLead.facts,
      reviewSignals: parsedLead.reviewSignals,
      rawResponseCount: result.rawResponses.length,
      rawResponses: result.rawResponses,
      rejectedFindings: result.status === "ok" ? result.rejectedFindings : [],
      rawParse: result.status === "ok" ? result.rawParse : null,
    },
  };
}

function serviceClassificationTraceStage(
  parsedLead: ParsedLeadData,
): LeadProcessingTraceStage {
  return {
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
  };
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

function manualReviewPipelineResult(params: {
  parsedLead: ParsedLeadData;
  reason: string;
  leadId: string;
  trace: LeadProcessingTrace;
}): TestLeadPipelineResult {
  const decisionResult = manualReviewDecision(params.reason);

  return {
    parsedLead: params.parsedLead,
    decisionResult,
    composed: null,
    responseStatus: "manual_review",
    responseType: "manual_review",
    draftText: null,
    autoSendAllowed: false,
    manualReviewReason: params.reason,
    evaluation: manualReviewEvaluation({
      leadId: params.leadId,
      serviceId: params.parsedLead.serviceId,
      reason: params.reason,
    }),
    trace: params.trace,
  };
}

function manualReviewDecision(reason: string): DecisionResult {
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
      params.serviceId,
    ),
    matchedAvailabilityRule:
      params.decisionResult.matchedAvailabilityRule ?? null,
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
  serviceId: string | null,
): MatchedPricingRule[] {
  const pricingRuleId = decisionResult.priceEstimate?.pricingRuleId;

  return rules.pricingRules
    .filter((rule) =>
      pricingRuleId
        ? rule.id === pricingRuleId
        : rule.active && rule.serviceId === serviceId,
    )
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      priceMin: rule.priceMin,
      priceMax: rule.priceMax,
      unit: rule.unit,
    }));
}
