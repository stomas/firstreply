import type { ExtractedFact } from "@/lib/extractor/types";
import type { RequirementConflictReason, RuleJson } from "@/lib/rules/types";

export function factMatchesExpectedFact(
  fact: ExtractedFact,
  expectedFact: Record<string, unknown>,
): boolean {
  if (fact.negated || !hasFactValue(fact)) {
    return false;
  }

  if (
    typeof expectedFact.kind === "string" &&
    fact.kind !== expectedFact.kind &&
    !isQuantityCompatibleWithConfiguredMeasurement(fact, expectedFact)
  ) {
    return false;
  }

  if (
    typeof expectedFact.dimension === "string" &&
    fact.dimension !== expectedFact.dimension &&
    !isQuantityCompatibleWithConfiguredMeasurement(fact, expectedFact)
  ) {
    return false;
  }

  const units = expectedUnits(expectedFact);
  if (
    units.length > 0 &&
    (!fact.unit ||
      !units.some((unit) => normalizeUnit(unit) === normalizeUnit(fact.unit!)))
  ) {
    return false;
  }

  return true;
}

function isQuantityCompatibleWithConfiguredMeasurement(
  fact: ExtractedFact,
  expectedFact: Record<string, unknown>,
): boolean {
  if (fact.kind !== "quantity" || expectedFact.kind !== "measurement") {
    return false;
  }

  return expectedUnits(expectedFact).some(
    (unit) => normalizeUnit(unit) === "vnt",
  );
}

function normalizeUnit(unit: string): string {
  const normalized = unit
    .trim()
    .toLocaleLowerCase("lt-LT")
    .replace(/²/gu, "2")
    .replace(/[.\s]/gu, "");

  if (normalized === "m2") {
    return "m2";
  }
  if (normalized.startsWith("vnt") || normalized === "vienetai") {
    return "vnt";
  }
  return normalized;
}

export function validateFactValue(
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

export function expectedUnits(expectedFact: Record<string, unknown>): string[] {
  if (Array.isArray(expectedFact.units)) {
    return expectedFact.units.filter(
      (unit): unit is string => typeof unit === "string",
    );
  }

  return typeof expectedFact.unit === "string" ? [expectedFact.unit] : [];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
