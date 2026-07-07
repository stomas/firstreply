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

  it("derives total length from per-item segment wording instead of extracting the per-item length as total", () => {
    const result = extractDeterministicFacts(
      "reikia 2 segmentu po 2m ir 1.5m aukščio",
    );
    const measurements = result.facts.filter(
      (fact) => fact.kind === "measurement",
    );

    assert.deepEqual(
      measurements.map((fact) => [fact.dimension, fact.value, fact.unit]),
      [
        ["length", 4, "m"],
        ["height", 1.5, "m"],
      ],
    );
    assert.ok(measurements[0].rawText.includes("2 segmentu po 2m"));
  });

  it("derives total length when per-item length appears before the item count", () => {
    const result = extractDeterministicFacts(
      "reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio",
    );
    const measurements = result.facts.filter(
      (fact) => fact.kind === "measurement",
    );

    assert.deepEqual(
      measurements.map((fact) => [fact.dimension, fact.value, fact.unit]),
      [
        ["length", 4, "m"],
        ["height", 1.5, "m"],
      ],
    );
    assert.ok(
      measurements[0].rawText.includes("2m segmento kokius 2 vienetus"),
    );
  });

  it("parses 20 segment syntax variants as total length and height", () => {
    const inquiries = [
      "Hey, reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos?",
      "Reikia 2 segmentai po 2 m, aukštis 1,5 m.",
      "Reikia 2 vnt segmentų po 2 m ir aukštis 1.5 m.",
      "Reikia du segmentai po 2m, 1.5m aukščio.",
      "Reikia 2 segmentus po 2 metrus, aukštis 1,5 metro.",
      "Reikia 2 segmentai kiekvienas po 2m, 1.5m aukščio.",
      "Reikia 2 segmentai, kiekvienas po 2m, aukštis 1.5m.",
      "Reikia segmentų 2 vnt po 2m, aukštis 1.5m.",
      "Reikia 2x2m segmentų, aukštis 1.5m.",
      "Reikia 2 x 2 m segmentų, 1,5 m aukščio.",
      "Reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio.",
      "Reikia 2 m segmentų 2 vnt, aukštis 1.5m.",
      "Reikia 2m ilgio segmentų 2 vienetai, aukštis 1.5m.",
      "Reikia 2 metrų segmento 2 vienetus, 1.5 m aukščio.",
      "Reikia segmentai: 2 vnt po 2 m, aukštis 1,5 m.",
      "Reikia segmentų - 2 vnt po 2m, aukštis 1.5m.",
      "Kaina 2 segmentams po 2m, 1.5m aukščio?",
      "Turim 2 dalių po 2m tvorą, aukštis 1.5m?",
      "Reikia 2 skydų po 2m, 1.5m aukščio.",
      "Reikia du skydai po 2m ir aukštis 1.5m.",
    ];

    for (const inquiry of inquiries) {
      const result = extractDeterministicFacts(inquiry);
      const measurements = result.facts.filter(
        (fact) => fact.kind === "measurement",
      );

      assert.deepEqual(
        measurements.map((fact) => [fact.dimension, fact.value, fact.unit]),
        [
          ["length", 4, "m"],
          ["height", 1.5, "m"],
        ],
        inquiry,
      );
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
});
