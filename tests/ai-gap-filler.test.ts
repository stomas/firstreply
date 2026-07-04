import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppConfigError } from "../lib/app-errors";
import {
  assertAiGapFillerConfigured,
  needsAiGapFiller,
} from "../lib/ai/gap-filler";
import type { RequirementResolutionResult } from "../lib/rules/types";

describe("AI gap filler configuration gate", () => {
  it("requires AI when resolver has pending subject bindings", () => {
    assert.equal(
      needsAiGapFiller({
        resolvedRequirements: { fence_length: null },
        unresolvedRequirements: [
          {
            requirementKey: "fence_length",
            label: "Tvoros ilgis",
            question: "Kiek metrų tvoros reikėtų?",
            required: true,
            affectsPrice: true,
            status: "pending_binding",
            candidateFactRefs: ["fact_1"],
          },
        ],
        conflicts: [],
      }),
      true,
    );
  });

  it("does not require AI when information is simply absent", () => {
    assert.equal(
      needsAiGapFiller({
        resolvedRequirements: { fence_length: null },
        unresolvedRequirements: [
          {
            requirementKey: "fence_length",
            label: "Tvoros ilgis",
            question: "Kiek metrų tvoros reikėtų?",
            required: true,
            affectsPrice: true,
            status: "unresolved",
            candidateFactRefs: [],
          },
        ],
        conflicts: [],
      }),
      false,
    );
  });

  it("stops with AI_NOT_CONFIGURED when AI is required but config is missing", () => {
    const result: RequirementResolutionResult = {
      resolvedRequirements: { fence_length: null },
      unresolvedRequirements: [
        {
          requirementKey: "fence_length",
          label: "Tvoros ilgis",
          question: "Kiek metrų tvoros reikėtų?",
          required: true,
          affectsPrice: true,
          status: "pending_binding",
          candidateFactRefs: ["fact_1"],
        },
      ],
      conflicts: [],
    };

    assert.throws(
      () =>
        assertAiGapFillerConfigured(result, {
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
        }),
      (error) =>
        error instanceof AppConfigError &&
        error.message.includes("AI_NOT_CONFIGURED"),
    );
  });
});
