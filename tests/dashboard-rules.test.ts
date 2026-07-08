import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDashboardPricingRuleForm,
  parseDashboardRequirementForm,
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
