import { AppConfigError } from "@/lib/app-errors";

export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";

export type AiEnvironment = {
  [key: string]: string | undefined;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type AiModelRequest = {
  system: string;
  user: string;
  model: string;
};

export type AiModelCaller = (request: AiModelRequest) => Promise<string>;

export function isAiConfigured(env: AiEnvironment = process.env): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim() && env.OPENAI_MODEL?.trim());
}

export function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

// AI kartais grąžina rėžį kaip objektą value:{min,max} (pvz. „apie 1.5-1.7").
// Normalizuojam į value=null + valueMin/valueMax (kaip likusioje sistemoje),
// kad zod parse nekristų. Naudojama fact schemų preprocess'e.
export function normalizeRangeFactValue(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const fact = raw as Record<string, unknown>;
  const value = fact.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return raw;
  }
  const range = value as Record<string, unknown>;
  if (typeof range.min !== "number" && typeof range.max !== "number") {
    return raw;
  }
  return {
    ...fact,
    value: null,
    valueMin:
      typeof range.min === "number" ? range.min : (fact.valueMin ?? null),
    valueMax:
      typeof range.max === "number" ? range.max : (fact.valueMax ?? null),
  };
}

export async function callOpenAiResponsesApi(
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
    throw new Error("AI request failed.");
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);
  if (!text) {
    throw new Error("AI response is empty.");
  }

  return text;
}

export function extractOutputText(json: unknown): string | null {
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
