import { z } from "zod";
import { AppConfigError } from "@/lib/app-errors";
import {
  AI_NOT_CONFIGURED,
  callOpenAiResponsesApi,
  isAiConfigured,
  normalizeRangeFactValue,
  stripJsonFence,
  type AiEnvironment,
  type AiModelCaller,
  type AiModelRequest,
} from "@/lib/ai/openai-client";
import type { ExtractedFact, PrimaryIntent } from "@/lib/extractor/types";
import { resolveRequirements } from "@/lib/requirements/resolve-requirements";
import type {
  DecisionRequirement,
  RequirementResolutionResult,
  ServiceSubjectRule,
} from "@/lib/rules/types";
import { verifyComputation } from "@/lib/verifier/computation";
import { verifyAiEvidence } from "@/lib/verifier/evidence";

export { AI_NOT_CONFIGURED };

export type AiGapFillInput = {
  rawText: string;
  facts: ExtractedFact[];
  requirements: DecisionRequirement[];
  resolution: RequirementResolutionResult;
  subjects: ServiceSubjectRule[];
};

export type RejectedAiFinding = {
  type: "binding" | "newFact";
  target: string;
  reason:
    | "EVIDENCE_NOT_FOUND"
    | "VALUE_NOT_IN_EVIDENCE"
    | "SUBJECT_NOT_ALLOWED"
    | "PER_ITEM_MEASUREMENT_REQUIRES_DERIVED_FACT"
    | "COMPUTATION_MISMATCH"
    | "DERIVED_FACT_REQUIRES_NUMERIC_VALUE";
};

export type AiGapFillResult =
  | {
      status: "ok";
      facts: ExtractedFact[];
      resolution: RequirementResolutionResult;
      primaryIntent: PrimaryIntent | null;
      rawResponses: string[];
      rejectedFindings: RejectedAiFinding[];
    }
  | {
      status: "manual_review";
      reason: "AI_PARSE_FAILED";
      rawResponses: string[];
    };

const aiBindingSchema = z.object({
  factId: z.string(),
  subject: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

const aiNewFactSchema = z.preprocess(
  normalizeRangeFactValue,
  z.object({
    requirementKey: z.string(),
    kind: z.string(),
    dimension: z.string().nullable().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
    valueMin: z.number().nullable().optional(),
    valueMax: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    evidence: z.string(),
    confidence: z.number().min(0).max(1),
    computation: z
      .object({
        op: z.enum(["multiply", "add"]),
        inputs: z.array(z.string()),
      })
      .nullable()
      .optional(),
  }),
);

const aiConflictSchema = z.object({
  factId: z.string(),
  reason: z.string(),
});

const aiGapFillResponseSchema = z.object({
  bindings: z.array(aiBindingSchema).default([]),
  newFacts: z.array(aiNewFactSchema).default([]),
  conflicts: z.array(aiConflictSchema).default([]),
  serviceClassification: z
    .object({
      id: z.string(),
      confidence: z.number().min(0).max(1),
    })
    .nullable()
    .default(null),
  primaryIntent: z
    .enum([
      "requests_quote",
      "asks_offering",
      "asks_availability",
      "asks_process",
      "provides_info",
      "other",
    ])
    .nullable()
    .default(null),
});

type AiGapFillResponse = z.infer<typeof aiGapFillResponseSchema>;

export function needsAiGapFiller(
  resolution: RequirementResolutionResult,
): boolean {
  return resolution.unresolvedRequirements.some(
    (requirement) =>
      requirement.status === "pending_binding" ||
      requirement.status === "unresolved",
  );
}

export function assertAiGapFillerConfigured(
  resolution: RequirementResolutionResult,
  env: AiEnvironment = process.env,
): void {
  if (!needsAiGapFiller(resolution)) {
    return;
  }

  if (isAiConfigured(env)) {
    return;
  }

  throw new AppConfigError(
    `${AI_NOT_CONFIGURED}: AI gap filler requires OPENAI_API_KEY and OPENAI_MODEL because deterministic facts need subject binding or unresolved requirements.`,
  );
}

export async function fillAiGaps(
  input: AiGapFillInput,
  options: {
    env?: AiEnvironment;
    callModel?: AiModelCaller;
  } = {},
): Promise<AiGapFillResult> {
  const env = options.env ?? process.env;
  assertAiGapFillerConfigured(input.resolution, env);

  if (!needsAiGapFiller(input.resolution)) {
    return {
      status: "ok",
      facts: input.facts,
      resolution: input.resolution,
      primaryIntent: null,
      rawResponses: [],
      rejectedFindings: [],
    };
  }

  const request = buildAiRequest(input, env);
  const callModel = options.callModel ?? callOpenAiResponsesApi;
  const rawResponses: string[] = [];
  let parsed: AiGapFillResponse | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawResponse = await callModel(request);
    rawResponses.push(rawResponse);
    parsed = parseAiResponse(rawResponse);

    if (parsed) {
      break;
    }
  }

  if (!parsed) {
    return {
      status: "manual_review",
      reason: "AI_PARSE_FAILED",
      rawResponses,
    };
  }

  const applied = applyAiResponse(input, parsed);

  return {
    status: "ok",
    facts: applied.facts,
    resolution: resolveRequirements({
      facts: applied.facts,
      requirements: input.requirements,
    }),
    primaryIntent: parsed.primaryIntent,
    rawResponses,
    rejectedFindings: applied.rejectedFindings,
  };
}

function buildAiRequest(
  input: AiGapFillInput,
  env: AiEnvironment,
): AiModelRequest {
  return {
    model: env.OPENAI_MODEL?.trim() ?? "",
    system:
      "Tu esi teksto faktų ekstraktorius. Grąžink TIK validų JSON pagal schemą, jokio kito teksto. Griežtos taisyklės: 1. NEKURK reikšmių, kurių nėra pateiktame tekste. 2. Kiekvienam radiniui privalomas evidence. 3. subject reikšmės TIK iš pateikto leidžiamo sąrašo. 4. Deterministinių faktų reikšmių keisti negalima. 5. Jei tekstas turi konstrukciją kaip „2 segmentai po 2m“, NEPRIRIŠK 2m kaip bendro ilgio; jei reikia bendro ilgio, grąžink newFact su computation, nurodančiu, kurie tekste esantys faktai dauginami/sudedami (pvz. kiekis × ilgis), ir jų input faktų id iš existingFacts. NEGALIMA grąžinti išvestinio (derived) fakto be computation. Reikšmės pats neskaičiuok tiksliai — kodas perskaičiuos ir patikrins; svarbu teisingi input id ir op. 6. Jei informacijos tekste nėra, grąžink requirement kaip nerastą. 7. primaryIntent: pagrindinis kliento tikslas, TIK viena iš reikšmių: requests_quote (prašo kainos), asks_offering (klausia ar tokią paslaugą teikiate/gaminate/montuojate), asks_availability (klausia termino/laisvo laiko), asks_process (klausia proceso/kaip vyksta), provides_info (tik pateikia informaciją), other. Jei neaišku — other. 8. Rėžis (pvz. 1.5-1.7) → value=null ir valueMin/valueMax skaičiai; NEGRĄŽINK value kaip objekto.",
    user: JSON.stringify({
      rawText: input.rawText,
      existingFacts: input.facts,
      allowedSubjects: input.subjects.map((subject) => ({
        key: subject.subjectKey,
        label: subject.labelLt,
        description: subject.descriptionLt,
        synonyms: subject.synonyms,
      })),
      unresolvedRequirements: input.resolution.unresolvedRequirements,
      responseSchema: {
        bindings: [
          {
            factId: "fact_1",
            subject: "fence",
            evidence: "pažodinė ištrauka",
            confidence: 0.0,
          },
        ],
        newFacts: [
          {
            requirementKey: "fence_height",
            kind: "measurement",
            dimension: "height",
            value: 1.7,
            valueMin: null,
            valueMax: null,
            unit: "m",
            evidence: "pažodinė ištrauka",
            confidence: 0.0,
            computation: null,
          },
          {
            requirementKey: "fence_length",
            kind: "measurement",
            dimension: "length",
            value: 4,
            valueMin: null,
            valueMax: null,
            unit: "m",
            evidence: "2 segmentai po 2m",
            confidence: 0.0,
            computation: { op: "multiply", inputs: ["fact_1", "fact_2"] },
          },
        ],
        conflicts: [{ factId: "fact_1", reason: "..." }],
        serviceClassification: null,
        primaryIntent: "other",
      },
    }),
  };
}

function parseAiResponse(rawResponse: string): AiGapFillResponse | null {
  try {
    const json = JSON.parse(stripJsonFence(rawResponse)) as unknown;
    return aiGapFillResponseSchema.parse(json);
  } catch {
    return null;
  }
}

function applyAiResponse(
  input: AiGapFillInput,
  response: AiGapFillResponse,
): { facts: ExtractedFact[]; rejectedFindings: RejectedAiFinding[] } {
  const allowedSubjects = new Set(
    input.subjects.map((subject) => subject.subjectKey),
  );
  const facts = input.facts.map((fact) => ({ ...fact }));
  const rejectedFindings: RejectedAiFinding[] = [];

  for (const binding of response.bindings) {
    const fact = facts.find((candidate) => candidate.id === binding.factId);
    if (!fact || fact.subject !== null) {
      continue;
    }

    if (!allowedSubjects.has(binding.subject)) {
      rejectedFindings.push({
        type: "binding",
        target: binding.factId,
        reason: "SUBJECT_NOT_ALLOWED",
      });
      continue;
    }

    const evidence = verifyAiEvidence({
      originalText: input.rawText,
      evidence: binding.evidence,
    });
    if (!evidence.ok) {
      rejectedFindings.push({
        type: "binding",
        target: binding.factId,
        reason: evidence.reason,
      });
      continue;
    }

    if (isPerItemMeasurementBinding(fact, binding.evidence)) {
      rejectedFindings.push({
        type: "binding",
        target: binding.factId,
        reason: "PER_ITEM_MEASUREMENT_REQUIRES_DERIVED_FACT",
      });
      continue;
    }

    fact.subject = binding.subject;
    fact.subjectSource = "ai";
    fact.confidence = Math.min(fact.confidence, binding.confidence);
  }

  let aiFactCounter = 0;
  for (const newFact of response.newFacts) {
    const requirement = input.requirements.find(
      (candidate) => candidate.requirementKey === newFact.requirementKey,
    );
    const expectedFact = asRecord(requirement?.expectedFact);
    const subject =
      typeof expectedFact?.subject === "string" ? expectedFact.subject : null;

    if (subject && !allowedSubjects.has(subject)) {
      rejectedFindings.push({
        type: "newFact",
        target: newFact.requirementKey,
        reason: "SUBJECT_NOT_ALLOWED",
      });
      continue;
    }

    if (newFact.computation) {
      // Derived faktas: evidence verifikuojame per input faktų span'us
      // (esamas evidence verifier), NE per išvestą skaičių — 4 tekste
      // „2 po 2m" neegzistuoja. Aritmetiką perskaičiuoja computation verifier.
      const evidence = verifyAiEvidence({
        originalText: input.rawText,
        evidence: newFact.evidence,
      });
      if (!evidence.ok) {
        rejectedFindings.push({
          type: "newFact",
          target: newFact.requirementKey,
          reason: evidence.reason,
        });
        continue;
      }

      if (typeof newFact.value !== "number") {
        rejectedFindings.push({
          type: "newFact",
          target: newFact.requirementKey,
          reason: "DERIVED_FACT_REQUIRES_NUMERIC_VALUE",
        });
        continue;
      }

      const computed = verifyComputation({
        facts,
        computation: newFact.computation,
        expectedValue: newFact.value,
        expectedUnit: newFact.unit ?? null,
      });
      if (!computed.ok) {
        rejectedFindings.push({
          type: "newFact",
          target: newFact.requirementKey,
          reason: "COMPUTATION_MISMATCH",
        });
        continue;
      }

      aiFactCounter += 1;
      facts.push({
        id: `ai_fact_${aiFactCounter}`,
        kind: newFact.kind as ExtractedFact["kind"],
        subject,
        subjectSource: "ai",
        dimension: (newFact.dimension ?? null) as ExtractedFact["dimension"],
        value: computed.value,
        valueMin: null,
        valueMax: null,
        unit: computed.unit as ExtractedFact["unit"],
        rawText: newFact.evidence,
        evidenceVerified: true,
        source: "ai",
        confidence: newFact.confidence,
        negated: false,
        derived: true,
        computation: {
          op: newFact.computation.op,
          inputs: newFact.computation.inputs,
        },
      });
      continue;
    }

    const evidence = verifyAiEvidence({
      originalText: input.rawText,
      evidence: newFact.evidence,
      value: newFact.value,
      valueMin: newFact.valueMin,
      valueMax: newFact.valueMax,
    });
    if (!evidence.ok) {
      rejectedFindings.push({
        type: "newFact",
        target: newFact.requirementKey,
        reason: evidence.reason,
      });
      continue;
    }

    aiFactCounter += 1;
    facts.push({
      id: `ai_fact_${aiFactCounter}`,
      kind: newFact.kind as ExtractedFact["kind"],
      subject,
      subjectSource: "ai",
      dimension: (newFact.dimension ?? null) as ExtractedFact["dimension"],
      value: newFact.value,
      valueMin: newFact.valueMin ?? null,
      valueMax: newFact.valueMax ?? null,
      unit: (newFact.unit ?? null) as ExtractedFact["unit"],
      rawText: newFact.evidence,
      evidenceVerified: true,
      source: "ai",
      confidence: newFact.confidence,
      negated: false,
    });
  }

  for (const conflict of response.conflicts) {
    const fact = facts.find((candidate) => candidate.id === conflict.factId);
    if (!fact) {
      continue;
    }

    fact.confidence = Math.min(fact.confidence, 0.5);
  }

  return { facts, rejectedFindings };
}

function isPerItemMeasurementBinding(
  fact: ExtractedFact,
  evidence: string,
): boolean {
  if (fact.kind !== "measurement" || typeof fact.value !== "number") {
    return false;
  }

  const derived = perItemDerivedTotal(`${fact.rawText} ${evidence}`);
  return (
    derived !== null &&
    nearlyEqual(derived.perUnit, fact.value) &&
    !nearlyEqual(derived.total, fact.value)
  );
}

function perItemDerivedTotal(
  value: string,
): { perUnit: number; total: number } | null {
  const normalized = normalizeText(value);
  const match = normalized.match(
    /\b(?<count>\d+(?:[.,]\d+)?)\s+\p{L}+\s+po\s+(?<perUnit>\d+(?:[.,]\d+)?)\s*(?:m|metrai|metru|metro|metrus)?\b/u,
  );
  if (!match?.groups) {
    return null;
  }

  const count = parseNumber(match.groups.count);
  const perUnit = parseNumber(match.groups.perUnit);
  if (count === null || perUnit === null) {
    return null;
  }

  return { perUnit, total: count * perUnit };
}

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001;
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}.,]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
