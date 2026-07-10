import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPricingRuleJson,
  describePricingRuleSupport,
  getUnsupportedPricingRuleCount,
  isRequirementKeyReferenced,
  parseAdvancedRequirementForm,
  parsePricingBuilderForm,
  parseSuperAdminServiceForm,
  parseSubjectForm,
  subjectDeleteBlockedByRequirements,
} from "../lib/dashboard/super-admin";

function subjectForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    serviceId: "service_1",
    subjectId: "subject_1",
    subjectKey: "fence",
    labelLt: "Tvora",
    descriptionLt: "Segmentinės ir kitos tvoros.",
    synonyms: "tvora, segmentai, tvora",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

function requirementForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    serviceId: "service_1",
    requirementId: "req_1",
    requirementKey: "fence_height",
    label: "Tvoros aukštis",
    question: "Kokio aukščio tvoros reikia?",
    expectedKind: "measurement",
    subjectKey: "fence",
    dimension: "height",
    units: "m",
    validationMin: "1",
    validationMax: "3",
    required: "on",
    affectsPrice: "on",
    active: "on",
    priority: "20",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

function pricingForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    serviceId: "service_1",
    pricingRuleId: "price_1",
    name: "Segmentinė tvora pagal metrą",
    ruleType: "per_unit",
    requirementKey: "fence_length",
    ruleUnit: "m",
    currency: "EUR",
    pricePerUnit: "38",
    priceMin: "32",
    priceMax: "75",
    unit: "€/m",
    requires: "fence_height, fence_length",
    modifierRequirementKey_0: "fence_height",
    modifierGte_0: "1,7",
    modifierPricePerUnitDelta_0: "6",
    autoSendAllowed: "on",
    active: "on",
    disclaimerText: "Orientacinė kaina.",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("super admin service form", () => {
  it("parses a new client-scoped service", () => {
    const formData = new FormData();
    formData.set("name", " Segmentinės tvoros montavimas ");
    formData.set("label", " Segmentinė tvora ");
    formData.set("keywords", "tvora, tvoros, segmentinė, tvora");
    formData.set("active", "on");

    assert.deepEqual(parseSuperAdminServiceForm(formData), {
      ok: true,
      value: {
        name: "Segmentinės tvoros montavimas",
        label: "Segmentinė tvora",
        keywords: ["tvora", "tvoros", "segmentinė"],
        active: true,
      },
    });
  });

  it("requires a service name", () => {
    assert.deepEqual(parseSuperAdminServiceForm(new FormData()), {
      ok: false,
      error: "Įveskite paslaugos pavadinimą.",
    });
  });
});

describe("super admin subject forms", () => {
  it("parses and deduplicates comma-separated synonyms", () => {
    const result = parseSubjectForm(subjectForm());

    assert.deepEqual(result, {
      ok: true,
      value: {
        serviceId: "service_1",
        subjectId: "subject_1",
        subjectKey: "fence",
        labelLt: "Tvora",
        descriptionLt: "Segmentinės ir kitos tvoros.",
        synonyms: ["tvora", "segmentai"],
      },
    });
  });

  it("rejects non slug-like subject keys", () => {
    const result = parseSubjectForm(subjectForm({ subjectKey: "Fence-1" }));

    assert.equal(result.ok, false);
    assert.match(result.error, /mažosios raidės/u);
  });
});

describe("super admin advanced requirements", () => {
  it("parses the supported measurement shape", () => {
    const result = parseAdvancedRequirementForm(requirementForm());

    assert.deepEqual(result, {
      ok: true,
      value: {
        serviceId: "service_1",
        requirementId: "req_1",
        requirementKey: "fence_height",
        label: "Tvoros aukštis",
        question: "Kokio aukščio tvoros reikia?",
        expectedKind: "measurement",
        subjectKey: "fence",
        dimension: "height",
        units: ["m"],
        validationMin: 1,
        validationMax: 3,
        required: true,
        affectsPrice: true,
        active: true,
        priority: 20,
      },
    });
  });

  it("requires measurement kind and at least one unit", () => {
    const badKind = parseAdvancedRequirementForm(
      requirementForm({ expectedKind: "count" }),
    );
    const missingUnits = parseAdvancedRequirementForm(
      requirementForm({ units: "" }),
    );

    assert.equal(badKind.ok, false);
    assert.match(badKind.error, /measurement/u);
    assert.equal(missingUnits.ok, false);
    assert.match(missingUnits.error, /vienetą/u);
  });
});

describe("super admin pricing builder", () => {
  it("parses modifiers and builds engine-compatible JSON", () => {
    const result = parsePricingBuilderForm(pricingForm());

    assert.equal(result.ok, true);
    assert.deepEqual(result.value.modifiers, [
      {
        requirementKey: "fence_height",
        gte: 1.7,
        pricePerUnitDelta: 6,
      },
    ]);
    assert.deepEqual(buildPricingRuleJson(result.value), {
      type: "per_unit",
      requirementKey: "fence_length",
      unit: "m",
      currency: "EUR",
      requires: ["fence_length", "fence_height"],
      pricePerUnit: 38,
      modifiers: [
        {
          if: { requirementKey: "fence_height", gte: 1.7 },
          pricePerUnitDelta: 6,
        },
      ],
    });
  });

  it("does not require pricePerUnit for range estimates", () => {
    const result = parsePricingBuilderForm(
      pricingForm({ ruleType: "range_estimate", pricePerUnit: "" }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(buildPricingRuleJson(result.value), {
      type: "range_estimate",
      requirementKey: "fence_length",
      unit: "m",
      currency: "EUR",
      requires: ["fence_length", "fence_height"],
    });
  });

  it("rejects incomplete modifier rows", () => {
    const result = parsePricingBuilderForm(
      pricingForm({ modifierPricePerUnitDelta_0: "" }),
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /modifikatoriaus/u);
  });
});

describe("super admin support and reference guards", () => {
  it("detects supported and unsupported pricing JSON", () => {
    assert.deepEqual(
      describePricingRuleSupport({
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        currency: "EUR",
        requires: ["fence_length"],
        pricePerUnit: 38,
      }),
      { supported: true, reason: null },
    );
    assert.equal(
      describePricingRuleSupport({ type: "custom" }).supported,
      false,
    );
    assert.equal(describePricingRuleSupport(null).supported, false);
  });

  it("counts unsupported pricing structures", () => {
    assert.equal(
      getUnsupportedPricingRuleCount([
        {
          rule: {
            type: "per_unit",
            requirementKey: "x",
            unit: "m",
            pricePerUnit: 1,
          },
        },
        { rule: { type: "custom" } },
        { rule: null },
      ]),
      2,
    );
  });

  it("guards subject and requirement references", () => {
    assert.equal(
      subjectDeleteBlockedByRequirements("fence", [
        {
          active: true,
          expectedFact: { kind: "measurement", subject: "fence" },
        },
      ]),
      true,
    );
    assert.equal(
      isRequirementKeyReferenced("fence_height", [
        {
          active: true,
          rule: {
            type: "per_unit",
            requirementKey: "fence_length",
            requires: ["fence_length"],
            modifiers: [
              {
                if: { requirementKey: "fence_height", gte: 1.7 },
                pricePerUnitDelta: 6,
              },
            ],
          },
        },
      ]),
      true,
    );
  });
});
