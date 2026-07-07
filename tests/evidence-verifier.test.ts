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

  it("accepts a derived per-item total when the evidence contains count and per-unit length", () => {
    const result = verifyAiEvidence({
      originalText: "Hey, ždž reikia 2 segmentu po 2m ir 1.5m aukščio.",
      evidence: "2 segmentu po 2m",
      value: 4,
    });

    assert.equal(result.ok, true);
  });

  it("rejects a derived per-item total when the arithmetic does not match", () => {
    const result = verifyAiEvidence({
      originalText: "Hey, ždž reikia 2 segmentu po 2m ir 1.5m aukščio.",
      evidence: "2 segmentu po 2m",
      value: 5,
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "VALUE_NOT_IN_EVIDENCE",
    });
  });
});
