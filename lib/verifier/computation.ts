import type { ExtractedFact, FactComputation } from "@/lib/extractor/types";

export type ComputationVerificationResult =
  | { ok: true; value: number; unit: string | null }
  | {
      ok: false;
      reason:
        | "INPUT_NOT_FOUND"
        | "INPUT_NOT_NUMERIC"
        | "RESULT_MISMATCH"
        | "UNIT_CONFLICT";
    };

export type ComputationVerificationInput = {
  facts: ExtractedFact[];
  computation: FactComputation;
  expectedValue: number;
  expectedUnit: string | null;
};

const TOLERANCE = 0.001;

// Kodas pats perskaičiuoja op — AI daro supratimą (kokie faktai dauginami),
// bet aritmetiką tikriname programiškai. Input faktų span'ai jau verifikuoti
// (deterministiniai faktai), todėl čia tikriname tik skaičius ir vienetus.
export function verifyComputation({
  facts,
  computation,
  expectedValue,
  expectedUnit,
}: ComputationVerificationInput): ComputationVerificationResult {
  if (computation.inputs.length === 0) {
    return { ok: false, reason: "INPUT_NOT_FOUND" };
  }

  const inputs: ExtractedFact[] = [];
  for (const inputId of computation.inputs) {
    const fact = facts.find((candidate) => candidate.id === inputId);
    if (!fact) {
      return { ok: false, reason: "INPUT_NOT_FOUND" };
    }
    if (typeof fact.value !== "number") {
      return { ok: false, reason: "INPUT_NOT_NUMERIC" };
    }
    inputs.push(fact);
  }

  const unit = resolveUnit(computation.op, inputs);
  if (unit === UNIT_CONFLICT) {
    return { ok: false, reason: "UNIT_CONFLICT" };
  }

  if (expectedUnit !== null && unit !== null && expectedUnit !== unit) {
    return { ok: false, reason: "UNIT_CONFLICT" };
  }

  const values = inputs.map((fact) => fact.value as number);
  const computed =
    computation.op === "multiply"
      ? values.reduce((total, value) => total * value, 1)
      : values.reduce((total, value) => total + value, 0);

  if (Math.abs(computed - expectedValue) > TOLERANCE) {
    return { ok: false, reason: "RESULT_MISMATCH" };
  }

  return { ok: true, value: computed, unit };
}

const UNIT_CONFLICT = Symbol("unit_conflict");

// multiply(quantity, measurement) → measurement vienetas (count vienetai "vnt"
// nekelia vieneto). add → visi vienetai turi sutapti.
function resolveUnit(
  op: FactComputation["op"],
  inputs: ExtractedFact[],
): string | null | typeof UNIT_CONFLICT {
  if (op === "add") {
    const units = new Set(inputs.map((fact) => fact.unit ?? null));
    if (units.size > 1) {
      return UNIT_CONFLICT;
    }
    return inputs[0].unit ?? null;
  }

  const measurementUnits = Array.from(
    new Set(
      inputs
        .map((fact) => fact.unit)
        .filter((unit): unit is NonNullable<typeof unit> =>
          Boolean(unit && unit !== "vnt"),
        ),
    ),
  );

  if (measurementUnits.length > 1) {
    return UNIT_CONFLICT;
  }

  return measurementUnits[0] ?? null;
}
