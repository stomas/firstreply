import { z } from "zod";
import {
  callOpenAiResponsesApi,
  isAiConfigured,
  normalizeRangeFactValue,
  stripJsonFence,
  type AiEnvironment,
  type AiModelCaller,
  type AiModelRequest,
} from "@/lib/ai/openai-client";
import type {
  DecisionRequirement,
  ResolvedRequirementValue,
} from "@/lib/rules/types";
import type { ServiceSubjectRule } from "@/lib/rules/types";
import { verifyAiEvidence } from "@/lib/verifier/evidence";

export function isShadowEnabled(env: AiEnvironment = process.env): boolean {
  return env.SHADOW_AI_PARSE === "true";
}

// Range reikšmės normalizuojamos bendra normalizeRangeFactValue (openai-client),
// kad shadow nekristų su AI_PARSE_FAILED.
const shadowFactSchema = z.preprocess(
  normalizeRangeFactValue,
  z.object({
    requirementKey: z.string(),
    kind: z.string(),
    subject: z.string().nullable().optional(),
    dimension: z.string().nullable().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]).nullable(),
    valueMin: z.number().nullable().optional(),
    valueMax: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
    evidence: z.string(),
    confidence: z.number().min(0).max(1),
  }),
);

const shadowResponseSchema = z.object({
  facts: z.array(shadowFactSchema).default([]),
});

export type ShadowFact = z.infer<typeof shadowFactSchema>;
export type ShadowParseResult = { facts: ShadowFact[] };

export type ShadowDiffStatus =
  | "match"
  | "value_diff"
  | "ai_only"
  | "ai_missing";

export type ShadowDiffEntry = {
  status: ShadowDiffStatus;
  mainValue: unknown;
  shadowValue: unknown;
};

export type ShadowDiff = Record<string, ShadowDiffEntry>;

export type ShadowParseOutcome =
  | {
      status: "skipped";
      reason: "DISABLED" | "NOT_CONFIGURED" | "NO_SERVICE";
    }
  | {
      status: "rejected";
      reason: "AI_PARSE_FAILED";
      rawResponses: string[];
    }
  | {
      status: "ok";
      shadowParseResult: ShadowParseResult;
      shadowDiff: ShadowDiff;
      rawResponses: string[];
    };

export type RunShadowParseInput = {
  rawText: string;
  requirements: DecisionRequirement[];
  subjects: ServiceSubjectRule[];
  mainResolved: Record<string, ResolvedRequirementValue | null>;
};

// Šešėlinis pilnas AI parse — TIK matavimui. Rezultatas niekur nenaudojamas
// sprendimams; grąžinamas palyginimui su pagrindiniu parse. Tinklo klaidos
// (AI 500) propaguojamos kviečiančiajam, kuris jas gaudo (niekada nenumuša
// pagrindinio pipeline).
export async function runShadowParse(
  input: RunShadowParseInput,
  options: { env?: AiEnvironment; callModel?: AiModelCaller } = {},
): Promise<ShadowParseOutcome> {
  const env = options.env ?? process.env;

  if (!isShadowEnabled(env)) {
    return { status: "skipped", reason: "DISABLED" };
  }
  if (!isAiConfigured(env)) {
    return { status: "skipped", reason: "NOT_CONFIGURED" };
  }
  if (input.requirements.length === 0) {
    return { status: "skipped", reason: "NO_SERVICE" };
  }

  const request = buildShadowRequest(input, env);
  const callModel = options.callModel ?? callOpenAiResponsesApi;
  const rawResponses: string[] = [];
  let parsed: z.infer<typeof shadowResponseSchema> | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawResponse = await callModel(request);
    rawResponses.push(rawResponse);
    parsed = parseShadowResponse(rawResponse);
    if (parsed) {
      break;
    }
  }

  if (!parsed) {
    return { status: "rejected", reason: "AI_PARSE_FAILED", rawResponses };
  }

  const verifiedFacts = parsed.facts.filter(
    (fact) =>
      verifyAiEvidence({ originalText: input.rawText, evidence: fact.evidence })
        .ok,
  );
  const shadowParseResult: ShadowParseResult = { facts: verifiedFacts };
  const shadowDiff = computeShadowDiff(
    input.mainResolved,
    verifiedFacts,
    input.requirements,
  );

  return { status: "ok", shadowParseResult, shadowDiff, rawResponses };
}

export function computeShadowDiff(
  mainResolved: Record<string, ResolvedRequirementValue | null>,
  shadowFacts: ShadowFact[],
  requirements: DecisionRequirement[],
): ShadowDiff {
  const shadowByKey = new Map<string, ShadowFact>();
  for (const fact of shadowFacts) {
    if (!shadowByKey.has(fact.requirementKey)) {
      shadowByKey.set(fact.requirementKey, fact);
    }
  }

  const keys = new Set<string>([
    ...requirements.map((requirement) => requirement.requirementKey),
    ...shadowFacts.map((fact) => fact.requirementKey),
  ]);

  const diff: ShadowDiff = {};
  for (const key of keys) {
    const main = mainResolved[key] ?? null;
    const mainValue = toComparable(main);
    const shadow = shadowByKey.get(key) ?? null;
    const shadowValue = toComparable(shadow);

    const hasMain = mainValue !== null;
    const hasShadow = shadowValue !== null;

    let status: ShadowDiffStatus;
    if (hasMain && hasShadow) {
      status = valuesEqual(mainValue, shadowValue) ? "match" : "value_diff";
    } else if (!hasMain && hasShadow) {
      status = "ai_only";
    } else if (hasMain && !hasShadow) {
      status = "ai_missing";
    } else {
      continue;
    }

    diff[key] = { status, mainValue, shadowValue };
  }

  return diff;
}

type ValueLike = {
  value?: unknown;
  valueMin?: number | null;
  valueMax?: number | null;
};

// Reikšmė palyginimui: skaliaras arba range {min,max}; jei nieko — null.
function toComparable(source: ValueLike | null): unknown {
  if (!source) {
    return null;
  }
  if (source.value !== null && source.value !== undefined) {
    return source.value;
  }
  const min = source.valueMin ?? null;
  const max = source.valueMax ?? null;
  if (min !== null || max !== null) {
    return { min, max };
  }
  return null;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.001;
  }
  if (isRange(left) && isRange(right)) {
    return (
      numbersEqual(left.min, right.min) && numbersEqual(left.max, right.max)
    );
  }
  return left === right;
}

function isRange(
  value: unknown,
): value is { min: number | null; max: number | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    ("min" in value || "max" in value)
  );
}

function numbersEqual(left: number | null, right: number | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) < 0.001;
}

function buildShadowRequest(
  input: RunShadowParseInput,
  env: AiEnvironment,
): AiModelRequest {
  return {
    model: env.OPENAI_MODEL?.trim() ?? "",
    system:
      "Tu esi teksto faktų ekstraktorius (shadow matavimas). Iš kliento teksto ištrauk VISUS faktus, atitinkančius pateiktus requirements. Grąžink TIK validų JSON pagal schemą. Taisyklės: 1. NEKURK reikšmių, kurių nėra tekste. 2. Kiekvienam faktui privalomas evidence — pažodinis teksto fragmentas. 3. requirementKey TIK iš pateikto sąrašo. 4. Jei fakto tekste nėra, jo negrąžink. 5. Tiksli reikšmė → value (skaičius). Rėžis (pvz. „apie 1.5-1.7“) → value=null ir valueMin/valueMax skaičiai; NEGRĄŽINK value kaip objekto.",
    user: JSON.stringify({
      mode: "shadow_full_parse",
      rawText: input.rawText,
      requirements: input.requirements.map((requirement) => ({
        requirementKey: requirement.requirementKey,
        expectedFact: requirement.expectedFact,
      })),
      allowedSubjects: input.subjects.map((subject) => ({
        key: subject.subjectKey,
        label: subject.labelLt,
        description: subject.descriptionLt,
        synonyms: subject.synonyms,
      })),
      responseSchema: {
        facts: [
          {
            requirementKey: "fence_length",
            kind: "measurement",
            subject: "fence",
            dimension: "length",
            value: 0.0,
            valueMin: null,
            valueMax: null,
            unit: "m",
            evidence: "pažodinė ištrauka",
            confidence: 0.0,
          },
        ],
      },
    }),
  };
}

function parseShadowResponse(
  rawResponse: string,
): z.infer<typeof shadowResponseSchema> | null {
  try {
    return shadowResponseSchema.parse(JSON.parse(stripJsonFence(rawResponse)));
  } catch {
    return null;
  }
}
