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
      const clarificationQuestion = buildValidationClarification(
        fact,
        requirement.validation,
        requirement.questionTextIfMissing,
      );
      conflicts.push({
        requirementKey: requirement.requirementKey,
        factRefs: [fact.id],
        reason: validationIssue,
        clarificationQuestion,
      });
      unresolvedRequirements.push(
        toUnresolvedRequirement(
          requirement,
          "conflict",
          [fact.id],
          clarificationQuestion,
        ),
      );
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
  question: string = requirement.questionTextIfMissing,
): UnresolvedRequirement {
  return {
    requirementKey: requirement.requirementKey,
    label: requirement.label,
    question,
    required: requirement.required ?? true,
    affectsPrice: requirement.affectsPrice ?? false,
    status,
    candidateFactRefs,
  };
}

function buildValidationClarification(
  fact: ExtractedFact,
  validation: DecisionRequirement["validation"],
  fallbackQuestion: string,
): string {
  const rule = asRecord(validation);
  const value = numericFactValue(fact);
  const min = typeof rule?.min === "number" ? rule.min : null;
  const max = typeof rule?.max === "number" ? rule.max : null;

  if (value === null || (min === null && max === null)) {
    return fallbackQuestion;
  }

  const unit = displayUnit(fact.unit);
  const dimension = dimensionLabels(fact.dimension);
  const valueText = `${formatLtNumber(value)}${unit ? ` ${unit}` : ""}`;
  const rangeText = [min, max]
    .filter((bound): bound is number => bound !== null)
    .map(formatLtNumber)
    .join("–");
  const rangeWithUnit = `${rangeText}${unit ? ` ${unit}` : ""}`;
  const relation =
    max !== null && value > max
      ? `viršija įprastą ${rangeWithUnit} ribą`
      : min !== null && value < min
        ? `nesiekia įprastos ${rangeWithUnit} ribos`
        : `neatitinka įprastos ${rangeWithUnit} ribos`;

  return `Nurodytas ${valueText} ${dimension.nominative} ${relation}. Ar galite patikslinti planuojamą ${dimension.accusative}?`;
}

function numericFactValue(fact: ExtractedFact): number | null {
  if (typeof fact.value === "number") {
    return fact.value;
  }
  if (typeof fact.valueMax === "number") {
    return fact.valueMax;
  }
  if (typeof fact.valueMin === "number") {
    return fact.valueMin;
  }
  return null;
}

function displayUnit(unit: ExtractedFact["unit"]): string {
  if (unit === "m2") {
    return "m²";
  }
  if (unit === "vnt") {
    return "vnt.";
  }
  return unit ?? "";
}

function dimensionLabels(dimension: ExtractedFact["dimension"]): {
  nominative: string;
  accusative: string;
} {
  if (dimension === "area") {
    return { nominative: "plotas", accusative: "plotą" };
  }
  if (dimension === "width") {
    return { nominative: "plotis", accusative: "plotį" };
  }
  if (dimension === "height") {
    return { nominative: "aukštis", accusative: "aukštį" };
  }
  if (dimension === "count") {
    return { nominative: "kiekis", accusative: "kiekį" };
  }
  return { nominative: "ilgis", accusative: "ilgį" };
}

function formatLtNumber(value: number): string {
  return String(value).replace(".", ",");
}
