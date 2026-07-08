import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDashboardPricingRuleCreateForm,
  parseDashboardPricingRuleForm,
  parseDashboardRequirementCreateForm,
  parseDashboardRequirementForm,
  slugifyRequirementKey,
  summarizeDashboardRules,
  type DashboardRulesServiceGroup,
} from "../lib/dashboard/rules";
import { getDashboardNavigationItems } from "../lib/dashboard/navigation";

function pricingForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    pricingRuleId: "price_1",
    name: "Segmentinė tvora pagal metrą",
    priceMin: "32",
    priceMax: "75",
    unit: "€/m",
    pricePerUnit: "38",
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

function requirementForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    requirementId: "req_1",
    label: "Tvoros ilgis",
    question: "Kiek metrų tvoros reikėtų?",
    required: "on",
    affectsPrice: "on",
    active: "on",
    priority: "10",
    validationMin: "1",
    validationMax: "500",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("dashboard rules forms", () => {
  it("parses a full pricing rule form", () => {
    const result = parseDashboardPricingRuleForm(pricingForm());

    assert.deepEqual(result, {
      ok: true,
      value: {
        pricingRuleId: "price_1",
        name: "Segmentinė tvora pagal metrą",
        priceMin: 32,
        priceMax: 75,
        unit: "€/m",
        pricePerUnit: 38,
        autoSendAllowed: true,
        active: true,
        disclaimerText: "Orientacinė kaina.",
      },
    });
  });

  it("accepts Lithuanian comma decimals and empty optional numbers", () => {
    const result = parseDashboardPricingRuleForm(
      pricingForm({ priceMin: "32,5", priceMax: "", pricePerUnit: "" }),
    );

    assert.ok(result.ok);
    assert.equal(result.value.priceMin, 32.5);
    assert.equal(result.value.priceMax, null);
    assert.equal(result.value.pricePerUnit, null);
  });

  it("rejects a price range where min exceeds max", () => {
    const result = parseDashboardPricingRuleForm(
      pricingForm({ priceMin: "80", priceMax: "40" }),
    );

    assert.ok(!result.ok);
    assert.match(result.error, /negali būti didesnė/u);
  });

  it("rejects non-numeric and non-positive per-unit prices", () => {
    const nonNumeric = parseDashboardPricingRuleForm(
      pricingForm({ pricePerUnit: "daug" }),
    );
    const nonPositive = parseDashboardPricingRuleForm(
      pricingForm({ pricePerUnit: "0" }),
    );

    assert.ok(!nonNumeric.ok);
    assert.ok(!nonPositive.ok);
  });

  it("parses a full requirement form", () => {
    const result = parseDashboardRequirementForm(requirementForm());

    assert.deepEqual(result, {
      ok: true,
      value: {
        requirementId: "req_1",
        label: "Tvoros ilgis",
        question: "Kiek metrų tvoros reikėtų?",
        required: true,
        affectsPrice: true,
        active: true,
        priority: 10,
        validationMin: 1,
        validationMax: 500,
      },
    });
  });

  it("requires the customer-facing question text", () => {
    const result = parseDashboardRequirementForm(
      requirementForm({ question: "" }),
    );

    assert.ok(!result.ok);
    assert.match(result.error, /klausimo tekstą/u);
  });

  it("rejects a validation range where min exceeds max and defaults priority", () => {
    const badRange = parseDashboardRequirementForm(
      requirementForm({ validationMin: "10", validationMax: "2" }),
    );
    const noPriority = parseDashboardRequirementForm(
      requirementForm({ priority: "" }),
    );

    assert.ok(!badRange.ok);
    assert.ok(noPriority.ok);
    assert.equal(noPriority.value.priority, 100);
  });

  it("treats unchecked checkboxes as false", () => {
    const result = parseDashboardRequirementForm(
      requirementForm({ required: "", affectsPrice: "", active: "" }),
    );

    assert.ok(result.ok);
    assert.equal(result.value.required, false);
    assert.equal(result.value.affectsPrice, false);
    assert.equal(result.value.active, false);
  });
});

function pricingCreateForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    serviceId: "service_1",
    name: "Nauja taisyklė",
    ruleType: "per_unit",
    quantityKey: "fence_length",
    quantityUnit: "m",
    pricePerUnit: "38",
    priceMin: "32",
    priceMax: "75",
    unit: "€/m",
    active: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("dashboard rules create forms", () => {
  it("parses a per-unit pricing create form", () => {
    const formData = pricingCreateForm();
    formData.append("requires", "fence_height");
    const result = parseDashboardPricingRuleCreateForm(formData);

    assert.ok(result.ok);
    assert.equal(result.value.ruleType, "per_unit");
    assert.equal(result.value.quantityKey, "fence_length");
    assert.equal(result.value.pricePerUnit, 38);
    assert.deepEqual(result.value.requires, ["fence_height"]);
  });

  it("requires a per-unit price only for the per_unit type", () => {
    const missingPrice = parseDashboardPricingRuleCreateForm(
      pricingCreateForm({ pricePerUnit: "" }),
    );
    const rangeEstimate = parseDashboardPricingRuleCreateForm(
      pricingCreateForm({ ruleType: "range_estimate", pricePerUnit: "" }),
    );

    assert.ok(!missingPrice.ok);
    assert.match(missingPrice.error, /vieneto kainą/iu);
    assert.ok(rangeEstimate.ok);
    assert.equal(rangeEstimate.value.pricePerUnit, null);
  });

  it("rejects a missing quantity question", () => {
    const result = parseDashboardPricingRuleCreateForm(
      pricingCreateForm({ quantityKey: "" }),
    );

    assert.ok(!result.ok);
    assert.match(result.error, /kiekis/iu);
  });

  it("parses a requirement create form and slugifies the key from the label", () => {
    const formData = new FormData();
    formData.set("serviceId", "service_1");
    formData.set("label", "Vartų plotis");
    formData.set("question", "Koks vartų angos plotis?");
    formData.set("dimension", "width");
    formData.set("subjectKey", "gate");
    formData.set("required", "on");
    formData.set("active", "on");
    const result = parseDashboardRequirementCreateForm(formData);

    assert.ok(result.ok);
    assert.equal(result.value.requirementKey, "vartu_plotis");
    assert.equal(result.value.dimension, "width");
    assert.equal(result.value.subjectKey, "gate");
    assert.equal(result.value.priority, 100);
  });

  it("prefers an explicit requirement key over the label slug", () => {
    const formData = new FormData();
    formData.set("serviceId", "service_1");
    formData.set("label", "Vartų plotis");
    formData.set("question", "Koks vartų angos plotis?");
    formData.set("dimension", "width");
    formData.set("requirementKey", "gate_width");
    const result = parseDashboardRequirementCreateForm(formData);

    assert.ok(result.ok);
    assert.equal(result.value.requirementKey, "gate_width");
  });

  it("rejects an unknown dimension", () => {
    const formData = new FormData();
    formData.set("serviceId", "service_1");
    formData.set("label", "Kiekis");
    formData.set("question", "Kiek vienetų?");
    formData.set("dimension", "count");
    const result = parseDashboardRequirementCreateForm(formData);

    assert.ok(!result.ok);
    assert.match(result.error, /matmenį/iu);
  });
});

describe("slugifyRequirementKey", () => {
  it("normalizes Lithuanian labels into engine-safe keys", () => {
    assert.equal(slugifyRequirementKey("Tvoros ilgis"), "tvoros_ilgis");
    assert.equal(slugifyRequirementKey("Vartų plotis"), "vartu_plotis");
    assert.equal(slugifyRequirementKey("  fence_length  "), "fence_length");
    assert.equal(slugifyRequirementKey("!!!"), "");
  });
});

describe("dashboard rules summary", () => {
  const groups: DashboardRulesServiceGroup[] = [
    {
      serviceId: "service_1",
      serviceName: "Segmentinės tvoros",
      serviceActive: true,
      pricingRules: [
        pricingRow({ id: "p1", active: true, autoSendAllowed: true }),
        pricingRow({ id: "p2", active: false, autoSendAllowed: true }),
      ],
      requirements: [
        requirementRow({ id: "r1", active: true }),
        requirementRow({ id: "r2", active: false }),
      ],
    },
    {
      serviceId: "service_2",
      serviceName: "Vartai",
      serviceActive: true,
      pricingRules: [
        pricingRow({ id: "p3", active: true, autoSendAllowed: false }),
      ],
      requirements: [requirementRow({ id: "r3", active: true })],
    },
  ];

  it("counts active rules, auto-send and inactive entries", () => {
    assert.deepEqual(summarizeDashboardRules(groups), {
      pricingRules: 2,
      requirements: 2,
      autoSendEnabled: 1,
      inactive: 2,
    });
  });
});

describe("dashboard rules navigation", () => {
  it("exposes the rules page as live", () => {
    const rules = getDashboardNavigationItems().find(
      (item) => item.id === "rules",
    );

    assert.equal(rules?.status, "live");
    assert.equal(rules?.href, "/dashboard/rules");
  });
});

function pricingRow(overrides: {
  id: string;
  active: boolean;
  autoSendAllowed: boolean;
}) {
  return {
    id: overrides.id,
    name: "Taisyklė",
    priceMin: 30,
    priceMax: 70,
    unit: "€/m",
    active: overrides.active,
    autoSendAllowed: overrides.autoSendAllowed,
    ruleType: "per_unit",
    pricePerUnit: 38,
    requirementKey: "fence_length",
    requires: ["fence_length"],
    modifierSummaries: [],
    disclaimerText: null,
  };
}

function requirementRow(overrides: { id: string; active: boolean }) {
  return {
    id: overrides.id,
    requirementKey: "fence_length",
    label: "Tvoros ilgis",
    question: "Kiek metrų tvoros reikėtų?",
    required: true,
    affectsPrice: true,
    active: overrides.active,
    priority: 10,
    validationMin: 1,
    validationMax: 500,
    expectedFactSummary: "measurement · fence · length · m",
  };
}
