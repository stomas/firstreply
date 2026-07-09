import type { ExtractedFact } from "@/lib/extractor/types";
import {
  asRecord,
  factMatchesExpectedFact,
  validateFactValue,
} from "@/lib/requirements/fact-validation";
import type {
  DecisionRequirement,
  RequirementResolutionResult,
  ResolvedRequirementValue,
  UnresolvedRequirement,
} from "@/lib/rules/types";

type ResolveRequirementsInput = {
  facts: ExtractedFact[];
  requirements: DecisionRequirement[];
};

export function resolveRequirements({
  facts,
  requirements,
}: ResolveRequirementsInput): RequirementResolutionResult {
  const resolvedRequirements: RequirementResolutionResult["resolvedRequirements"] =
    {};
  const unresolvedRequirements: UnresolvedRequirement[] = [];
  const conflicts: RequirementResolutionResult["conflicts"] = [];

  for (const requirement of requirements.filter(
    (candidate) => candidate.active,
  )) {
    const expectedFact = asRecord(requirement.expectedFact);
    const matchingFacts = expectedFact
      ? facts.filter((fact) => factMatchesExpectedFact(fact, expectedFact))
      : [];
    const expectedSubject =
      typeof expectedFact?.subject === "string" ? expectedFact.subject : null;
    const subjectMatches = expectedSubject
      ? matchingFacts.filter((fact) => fact.subject === expectedSubject)
      : matchingFacts;
    const pendingBindingCandidates = expectedSubject
      ? matchingFacts.filter((fact) => fact.subject === null)
      : [];

    if (subjectMatches.length === 1) {
      const fact = subjectMatches[0];
      const validationIssue = validateFactValue(fact, requirement.validation);

      if (!validationIssue) {
        resolvedRequirements[requirement.requirementKey] =
          toResolvedRequirement(fact);
        continue;
      }

      resolvedRequirements[requirement.requirementKey] = null;
      conflicts.push({
        requirementKey: requirement.requirementKey,
        factRefs: [fact.id],
        reason: validationIssue,
      });
      unresolvedRequirements.push(toUnresolvedRequirement(requirement));
      continue;
    }

    if (subjectMatches.length > 1) {
      resolvedRequirements[requirement.requirementKey] = null;
      conflicts.push({
        requirementKey: requirement.requirementKey,
        factRefs: subjectMatches.map((fact) => fact.id),
        reason: "MULTIPLE_FACTS_FOR_REQUIREMENT",
      });
      unresolvedRequirements.push(
        toUnresolvedRequirement(
          requirement,
          "conflict",
          subjectMatches.map((fact) => fact.id),
        ),
      );
      continue;
    }

    const optionalOptOutFact = findOptionalOptOutFact({
      facts,
      requirement,
      expectedSubject,
    });
    if (optionalOptOutFact) {
      resolvedRequirements[requirement.requirementKey] =
        toResolvedRequirement(optionalOptOutFact);
      continue;
    }

    if (pendingBindingCandidates.length > 0) {
      resolvedRequirements[requirement.requirementKey] = null;
      unresolvedRequirements.push(
        toUnresolvedRequirement(
          requirement,
          "pending_binding",
          pendingBindingCandidates.map((fact) => fact.id),
        ),
      );
      continue;
    }

    resolvedRequirements[requirement.requirementKey] = null;
    unresolvedRequirements.push(toUnresolvedRequirement(requirement));
  }

  return {
    resolvedRequirements,
    unresolvedRequirements,
    conflicts,
  };
}

function findOptionalOptOutFact({
  facts,
  requirement,
  expectedSubject,
}: {
  facts: ExtractedFact[];
  requirement: DecisionRequirement;
  expectedSubject: string | null;
}): ExtractedFact | null {
  if ((requirement.required ?? true) !== false) {
    return null;
  }

  return (
    facts.find(
      (fact) =>
        fact.kind === "selection" &&
        fact.value === false &&
        fact.negated &&
        fact.evidenceVerified &&
        (fact.requirementKey === requirement.requirementKey ||
          (expectedSubject !== null && fact.subject === expectedSubject)),
    ) ?? null
  );
}

function toResolvedRequirement(fact: ExtractedFact): ResolvedRequirementValue {
  return {
    value: fact.value,
    valueMin: fact.valueMin,
    valueMax: fact.valueMax,
    unit: fact.unit,
    factRef: fact.id,
    source: fact.source,
    subjectSource: fact.subjectSource,
    confidence: fact.confidence,
    validationPassed: true,
    evidenceVerified: fact.evidenceVerified,
  };
}

function toUnresolvedRequirement(
  requirement: DecisionRequirement,
  status: UnresolvedRequirement["status"] = "unresolved",
  candidateFactRefs: string[] = [],
): UnresolvedRequirement {
  return {
    requirementKey: requirement.requirementKey,
    label: requirement.label,
    question: requirement.questionTextIfMissing,
    required: requirement.required ?? true,
    affectsPrice: requirement.affectsPrice ?? false,
    status,
    candidateFactRefs,
  };
}
