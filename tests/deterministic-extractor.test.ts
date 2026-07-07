import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDeterministicFacts } from "../lib/extractor/deterministic";

describe("extractDeterministicFacts", () => {
  it("extracts phone before measurements so phone digits are not measurements", () => {
    const result = extractDeterministicFacts(
      "Tel 860000000, reikia tvoros 45 m.",
    );

    assert.equal(result.contacts.phone?.normalized, "+37060000000");
    assert.deepEqual(
      result.facts
        .filter((fact) => fact.kind === "measurement")
        .map((fact) => fact.value),
      [45],
    );
  });

  it("normalizes Vilniaus rajonas to the municipality, not Vilnius city", () => {
    const result = extractDeterministicFacts(
      "Sveiki, reiktu tvoros 45 metrai, vilniaus rajone.",
    );

    assert.equal(result.location?.adminUnit.code, "vilniaus_r_sav");
    assert.equal(result.location?.adminUnit.label, "Vilniaus r. sav.");
  });

  it("extracts decimal and area measurements with Lithuanian units", () => {
    const result = extractDeterministicFacts("Terasa 120 kv.m, aukštis 1,5 m.");
    const area = result.facts.find((fact) => fact.dimension === "area");
    const height = result.facts.find((fact) => fact.dimension === "height");

    assert.equal(area?.value, 120);
    assert.equal(area?.unit, "m2");
    assert.equal(height?.value, 1.5);
    assert.equal(height?.unit, "m");
  });

  it("extracts height when the height word follows the meter value", () => {
    const result = extractDeterministicFacts(
      "Reikia 45 m tvoros, 1.7m aukščio.",
    );
    const height = result.facts.find((fact) => fact.dimension === "height");

    assert.equal(height?.value, 1.7);
    assert.equal(height?.unit, "m");
  });

  it("binds fence measurements when the nearby text explicitly names a fence", () => {
    const result = extractDeterministicFacts(
      "Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio.",
    );
    const measurements = result.facts.filter(
      (fact) => fact.kind === "measurement",
    );

    assert.deepEqual(
      measurements.map((fact) => [fact.dimension, fact.subject]),
      [
        ["length", "fence"],
        ["height", "fence"],
      ],
    );
    assert.deepEqual(
      measurements.map((fact) => fact.subjectSource),
      ["deterministic", "deterministic"],
    );
  });

  it("does not bind a measurement subject when fence and gate context conflict", () => {
    const result = extractDeterministicFacts("Reikia tvoros ir vartų 45 m.");
    const measurement = result.facts.find(
      (fact) => fact.kind === "measurement",
    );

    assert.equal(measurement?.subject, null);
    assert.equal(measurement?.subjectSource, null);
  });

  it("extracts ranges and approximate values", () => {
    const result = extractDeterministicFacts(
      "tvora apie 40-50 metru, kaunas, skubiai",
    );
    const range = result.facts.find((fact) => fact.kind === "measurement");

    assert.equal(range?.value, null);
    assert.equal(range?.valueMin, 40);
    assert.equal(range?.valueMax, 50);
    assert.equal(range?.confidence, 0.9);
    assert.equal(result.intents.isUrgent, true);
  });

  it("extracts per-item constructs as atoms without composing the total (AI does that)", () => {
    // Deterministika nebedaugina: „2 segmentu po 2m" → atomai kiekis 2 +
    // per-unit ilgis 2m (subject null, kad neatsirastų klaidingas bendras ilgis).
    // Kompoziciją (4m) daro AI su computation (žr. tests/derived-facts.test.ts).
    const result = extractDeterministicFacts(
      "reikia 2 segmentu po 2m ir 1.5m aukščio",
    );
    const measurements = result.facts.filter(
      (fact) => fact.kind === "measurement",
    );
    const quantities = result.facts.filter((fact) => fact.kind === "quantity");

    assert.deepEqual(
      measurements.map((fact) => [fact.dimension, fact.value, fact.subject]),
      [
        ["length", 2, null],
        ["height", 1.5, null],
      ],
    );
    assert.deepEqual(
      quantities.map((fact) => fact.value),
      [2],
    );
  });

  it("captures the count atom for multiplier and item-unit wording", () => {
    for (const [text, count] of [
      ["Reikia 2x2m segmentų, aukštis 1.5m.", 2],
      ["Reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio.", 2],
      ["Segmentai: trys po 2m, aukstis 1.5m.", 3],
    ] as const) {
      const result = extractDeterministicFacts(text);
      const quantities = result.facts.filter(
        (fact) => fact.kind === "quantity",
      );
      const perUnit = result.facts.find(
        (fact) => fact.kind === "measurement" && fact.dimension === "length",
      );

      assert.deepEqual(
        quantities.map((fact) => fact.value),
        [count],
        text,
      );
      assert.equal(perUnit?.value, 2, text);
      assert.equal(perUnit?.subject, null, text);
    }
  });

  it("extracts Lithuanian word-number quantities", () => {
    const result = extractDeterministicFacts(
      "reikia trys varteliai ir 2 vartai",
    );
    const quantities = result.facts.filter((fact) => fact.kind === "quantity");

    assert.deepEqual(
      quantities.map((fact) => fact.value),
      [3, 2],
    );
  });

  it("marks negated facts and does not use units when they are missing", () => {
    const result = extractDeterministicFacts("vartų nereikia, tik tvora 30");

    assert.equal(
      result.facts.some((fact) => fact.negated),
      true,
    );
    assert.equal(
      result.facts.some((fact) => fact.kind === "measurement"),
      false,
    );
  });

  it("classifies an offering question as asks_offering", () => {
    const result = extractDeterministicFacts(
      "labas, o turit pas save metaliniu vartu?",
    );

    assert.equal(result.intents.primaryIntent, "asks_offering");
    assert.equal(result.intents.asksPrice, false);
  });

  it("classifies a price question as requests_quote (price beats offering)", () => {
    const result = extractDeterministicFacts("kiek kainuotu tvora 45m");

    assert.equal(result.intents.primaryIntent, "requests_quote");
  });

  // QUESTION: neigimo atvejis. Kol kas grąžiname asks_offering — saugu, nes
  // OFFERING_ANSWER atsakymas yra faktinis iš DB (jokio automatinio „ne, nedarome").
  // TODO: nuspręsti, ar reikia atskiro neigimo intento (pvz. verifies_claim).
  it("TODO/QUESTION: treats a negated offering question as asks_offering for now", () => {
    const result = extractDeterministicFacts("ar tikrai nedarot vartu?");

    assert.equal(result.intents.primaryIntent, "asks_offering");
  });

  it("returns null primaryIntent when no intent phrase matches", () => {
    const result = extractDeterministicFacts("sveiki, turiu sklypą Vilniuje");

    assert.equal(result.intents.primaryIntent, null);
  });
});
