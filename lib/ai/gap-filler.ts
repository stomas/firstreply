import { z } from "zod";
import { AppConfigError } from "@/lib/app-errors";
import type { ExtractedFact } from "@/lib/extractor/types";
import { resolveRequirements } from "@/lib/requirements/resolve-requirements";
import type {
  DecisionRequirement,
  RequirementResolutionResult,
  ServiceSubjectRule,
} from "@/lib/rules/types";
import { verifyAiEvidence } from "@/lib/verifier/evidence";

export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";

type AiEnvironment = {
  [key: string]: string | undefined;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type AiModelRequest = {
  system: string;
  user: string;
  model: string;
};

type AiModelCaller = (request: AiModelRequest) => Promise<string>;

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
    | "PER_ITEM_MEASUREMENT_REQUIRES_DERIVED_FACT";
};

export type AiGapFillResult =
  | {
      status: "ok";
      facts: ExtractedFact[];
      resolution: RequirementResolutionResult;
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

const aiNewFactSchema = z.object({
  requirementKey: z.string(),
  kind: z.string(),
  dimension: z.string().nullable().optional(),
  value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

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

  if (env.OPENAI_API_KEY?.trim() && env.OPENAI_MODEL?.trim()) {
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
      "Tu esi teksto faktų ekstraktorius. Grąžink TIK validų JSON pagal schemą, jokio kito teksto. Griežtos taisyklės: 1. NEKURK reikšmių, kurių nėra pateiktame tekste. 2. Kiekvienam radiniui privalomas evidence. 3. subject reikšmės TIK iš pateikto leidžiamo sąrašo. 4. Deterministinių faktų reikšmių keisti negalima. 5. Jei tekstas turi konstrukciją kaip „2 segmentai po 2m“, NEPRIRIŠK 2m kaip bendro ilgio; jei reikia bendro ilgio, grąžink newFact su išvestiniu totalu 4m ir evidence „2 segmentai po 2m“. 6. Jei informacijos tekste nėra, grąžink requirement kaip nerastą.",
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
          },
        ],
        conflicts: [{ factId: "fact_1", reason: "..." }],
        serviceClassification: null,
      },
    }),
  };
}

async function callOpenAiResponsesApi(
  request: AiModelRequest,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppConfigError(
      `${AI_NOT_CONFIGURED}: OPENAI_API_KEY is missing.`,
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0,
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("AI gap filler request failed.");
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);
  if (!text) {
    throw new Error("AI gap filler response is empty.");
  }

  return text;
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

    const evidence = verifyAiEvidence({
      originalText: input.rawText,
      evidence: newFact.evidence,
      value: newFact.value,
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

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
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

function extractOutputText(json: unknown): string | null {
  if (!json || typeof json !== "object") {
    return null;
  }

  const outputText = (json as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n\n") : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
