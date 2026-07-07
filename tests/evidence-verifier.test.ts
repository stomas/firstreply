import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyAiEvidence } from "../lib/verifier/evidence";

describe("verifyAiEvidence", () => {
  it("accepts evidence that appears exactly in the original text", () => {
    const result = verifyAiEvidence({
      originalText: "Sveiki, reikia tvoros 45 metrai, Vilniaus rajone.",
      evidence: "tvoros 45 metrai",
      value: 45,
    });

    assert.equal(result.ok, true);
  });

  it("accepts fuzzy Lithuanian inflection differences within one edit", () => {
    const result = verifyAiEvidence({
      originalText: "Sveiki, reikia vartelių 2m prie tvoros.",
      evidence: "varteli 2m",
      value: 2,
    });

    assert.equal(result.ok, true);
  });

  it("rejects evidence that is not present in the original text", () => {
    const result = verifyAiEvidence({
      originalText: "Sveiki, reikia tvoros 45 metrai.",
      evidence: "vartai 6 m",
      value: 6,
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "EVIDENCE_NOT_FOUND",
    });
  });

  it("rejects new fact evidence when the numeric value is not in the evidence span", () => {
    const result = verifyAiEvidence({
      originalText: "Sveiki, reikia tvoros 45 metrai.",
      evidence: "reikia tvoros",
      value: 45,
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "VALUE_NOT_IN_EVIDENCE",
    });
  });

  it("rejects range evidence when one bound is not in the evidence span", () => {
    const result = verifyAiEvidence({
      originalText: "Sveiki, reikia tvoros. Aukštis apie 1.5-1.7.",
      evidence: "Aukštis apie 1.5-1.7",
      valueMin: 1.5,
      valueMax: 2.4,
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "VALUE_NOT_IN_EVIDENCE",
    });
  });

  // Išvestinių (derived) totalų evidence verifier nebeatpažįsta per regex —
  // 4 iš „2 po 2m" tekste neegzistuoja. Aritmetiką dabar tikrina
  // lib/verifier/computation.ts; derived faktams value nebeperduodamas.
  it("does not accept a derived total whose number is absent from the evidence", () => {
    const result = verifyAiEvidence({
      originalText: "Hey, ždž reikia 2 segmentu po 2m ir 1.5m aukščio.",
      evidence: "2 segmentu po 2m",
      value: 4,
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "VALUE_NOT_IN_EVIDENCE",
    });
  });
});
