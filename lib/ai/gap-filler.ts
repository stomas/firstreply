import { AppConfigError } from "@/lib/app-errors";
import type { RequirementResolutionResult } from "@/lib/rules/types";

export const AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED";

type AiEnvironment = {
  [key: string]: string | undefined;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export function needsAiGapFiller(
  resolution: RequirementResolutionResult,
): boolean {
  return resolution.unresolvedRequirements.some(
    (requirement) => requirement.status === "pending_binding",
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
    `${AI_NOT_CONFIGURED}: AI gap filler requires OPENAI_API_KEY and OPENAI_MODEL because deterministic facts need subject binding.`,
  );
}
