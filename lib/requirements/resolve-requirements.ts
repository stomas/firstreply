import type { ExtractedFact } from "@/lib/extractor/types";
import type {
  DecisionRequirement,
  RequirementConflictReason,
  RequirementResolutionResult,
  ResolvedRequirementValue,
  RuleJson,
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

function factMatchesExpectedFact(
  fact: ExtractedFact,
  expectedFact: Record<string, unknown>,
): boolean {
  if (fact.negated || !hasFactValue(fact)) {
    return false;
  }

  if (
    typeof expectedFact.kind === "string" &&
    fact.kind !== expectedFact.kind
  ) {
    return false;
  }

  if (
    typeof expectedFact.dimension === "string" &&
    fact.dimension !== expectedFact.dimension
  ) {
    return false;
  }

  const units = expectedUnits(expectedFact);
  if (units.length > 0 && (!fact.unit || !units.includes(fact.unit))) {
    return false;
  }

  return true;
}

function validateFactValue(
  fact: ExtractedFact,
  validation: RuleJson | undefined,
): RequirementConflictReason | null {
  const rule = asRecord(validation);
  if (!rule) {
    return null;
  }

  const allowedValues = Array.isArray(rule.allowedValues)
    ? rule.allowedValues
    : [];
  if (
    allowedValues.length > 0 &&
    !allowedValues.some((value) => value === fact.value)
  ) {
    return "VALUE_NOT_ALLOWED";
  }

  const numericValues = [fact.value, fact.valueMin, fact.valueMax].filter(
    (value): value is number => typeof value === "number",
  );
  const min = typeof rule.min === "number" ? rule.min : null;
  const max = typeof rule.max === "number" ? rule.max : null;

  if (
    numericValues.some(
      (value) => (min !== null && value < min) || (max !== null && value > max),
    )
  ) {
    return "VALUE_OUT_OF_RANGE";
  }

  return null;
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

function expectedUnits(expectedFact: Record<string, unknown>): string[] {
  if (Array.isArray(expectedFact.units)) {
    return expectedFact.units.filter(
      (unit): unit is string => typeof unit === "string",
    );
  }

  return typeof expectedFact.unit === "string" ? [expectedFact.unit] : [];
}

function hasFactValue(fact: ExtractedFact): boolean {
  if (typeof fact.value === "string") {
    return fact.value.trim().length > 0;
  }

  if (fact.value !== null && fact.value !== undefined && fact.value !== false) {
    return true;
  }

  return typeof fact.valueMin === "number" || typeof fact.valueMax === "number";
}

function asRecord(value: RuleJson | undefined): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}
