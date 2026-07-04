import type { DraftGenerationInput } from "@/lib/rules/types";

const AI_NOT_CONFIGURED = "AI generation is not configured.";

export async function generateLeadResponse(
  input: DraftGenerationInput,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();

  if (!apiKey || !model) {
    throw new Error(AI_NOT_CONFIGURED);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You write short Lithuanian first replies for service businesses. Use only supplied rules and lead data. Do not invent prices, dates, discounts, or facts. If information is missing, ask concise questions.",
        },
        {
          role: "user",
          content: JSON.stringify({
            lead: input.lead,
            responseType: input.responseType,
            missingRequirements: input.missingRequirements,
            matchedPricingRules: input.matchedPricingRules,
            matchedAvailabilityRule: input.matchedAvailabilityRule,
          }),
        },
      ],
      max_output_tokens: 600,
    }),
  });

  if (!response.ok) {
    console.error(
      `[ai] response generation failed with ${response.status} ${response.statusText}`,
    );
    throw new Error("response generation error");
  }

  const json = (await response.json()) as unknown;
  const text = extractOutputText(json);

  if (!text) {
    throw new Error("response generation error");
  }

  return text;
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
