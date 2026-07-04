export type EvidenceVerificationInput = {
  originalText: string;
  evidence: string;
  value?: unknown;
};

export type EvidenceVerificationResult =
  | { ok: true }
  | { ok: false; reason: "EVIDENCE_NOT_FOUND" | "VALUE_NOT_IN_EVIDENCE" };

export function verifyAiEvidence({
  originalText,
  evidence,
  value,
}: EvidenceVerificationInput): EvidenceVerificationResult {
  const normalizedOriginal = normalizeText(originalText);
  const normalizedEvidence = normalizeText(evidence);

  if (
    !normalizedEvidence ||
    !evidenceAppears(normalizedOriginal, normalizedEvidence)
  ) {
    return { ok: false, reason: "EVIDENCE_NOT_FOUND" };
  }

  if (
    typeof value === "number" &&
    !evidenceContainsNumber(normalizedEvidence, value)
  ) {
    return { ok: false, reason: "VALUE_NOT_IN_EVIDENCE" };
  }

  return { ok: true };
}

function evidenceAppears(
  normalizedOriginal: string,
  normalizedEvidence: string,
): boolean {
  if (normalizedOriginal.includes(normalizedEvidence)) {
    return true;
  }

  const originalTokens = normalizedOriginal.split(" ").filter(Boolean);
  const evidenceTokens = normalizedEvidence.split(" ").filter(Boolean);
  if (
    evidenceTokens.length === 0 ||
    evidenceTokens.length > originalTokens.length
  ) {
    return false;
  }

  for (
    let start = 0;
    start <= originalTokens.length - evidenceTokens.length;
    start += 1
  ) {
    const window = originalTokens.slice(start, start + evidenceTokens.length);
    const matches = evidenceTokens.every(
      (token, index) => tokenDistance(token, window[index]) <= 1,
    );

    if (matches) {
      return true;
    }
  }

  return false;
}

function evidenceContainsNumber(
  normalizedEvidence: string,
  value: number,
): boolean {
  const candidates = numberCandidates(value);
  const evidenceNumbers = normalizedEvidence.match(/\d+(?:[.,]\d+)?/gu) ?? [];

  return evidenceNumbers.some((number) =>
    candidates.includes(number.replace(",", ".")),
  );
}

function numberCandidates(value: number): string[] {
  const fixed = Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/u, "").replace(/\.$/u, "");

  return Array.from(new Set([fixed, fixed.replace(".", ",")])).map(
    (candidate) => candidate.replace(",", "."),
  );
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}.,]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokenDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );

  for (let row = 0; row < rows; row += 1) {
    distances[row][0] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    distances[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + substitutionCost,
      );
    }
  }

  return distances[left.length][right.length];
}
