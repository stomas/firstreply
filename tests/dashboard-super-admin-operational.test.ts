import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAutosendPolicyJson,
  buildScheduleRuleJson,
  buildSafeDefaultAutosendPolicyJson,
  describeAutosendPolicySupport,
  describeScheduleRuleSupport,
  getAllowedPlaceholders,
  parseAutosendPolicyForm,
  parseLocationZoneForm,
  parseResponseTemplateForm,
  parseScheduleRuleForm,
  responseTemplateWarningForKey,
  summarizeOperationalConfig,
} from "../lib/dashboard/super-admin-operational";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("super admin operational location zones", () => {
  it("parses Lithuanian decimals and served checkbox", () => {
    const result = parseLocationZoneForm(
      form({
        locationZoneId: "zone_1",
        adminUnitCode: "LT-VL",
        zone: "Vilnius",
        travelFeeEur: "12,50",
        served: "on",
      }),
    );

    assert.deepEqual(result, {
      ok: true,
      value: {
        locationZoneId: "zone_1",
        adminUnitCode: "LT-VL",
        zone: "Vilnius",
        travelFeeEur: 12.5,
        served: true,
      },
    });
  });

  it("requires an admin unit code", () => {
    const result = parseLocationZoneForm(
      form({
        adminUnitCode: "",
        zone: "Vilnius",
        travelFeeEur: "0",
      }),
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /admin unit/u);
  });
});

describe("super admin operational schedule rules", () => {
  it("builds supported lead_time_weeks JSON", () => {
    const result = parseScheduleRuleForm(
      form({
        scheduleRuleId: "schedule_1",
        minWeeks: "3",
        maxWeeks: "5",
      }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(buildScheduleRuleJson(result.value), {
      type: "lead_time_weeks",
      min: 3,
      max: 5,
    });
  });

  it("rejects inverted week ranges", () => {
    const result = parseScheduleRuleForm(
      form({
        minWeeks: "6",
        maxWeeks: "3",
      }),
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /didesnis/u);
  });

  it("detects unsupported schedule JSON", () => {
    assert.deepEqual(
      describeScheduleRuleSupport({
        type: "lead_time_weeks",
        min: 3,
        max: 5,
      }),
      { supported: true, reason: null },
    );
    assert.equal(
      describeScheduleRuleSupport({ type: "custom_schedule" }).supported,
      false,
    );
  });
});

describe("super admin operational autosend policy", () => {
  it("parses the supported autosend policy builder", () => {
    const result = parseAutosendPolicyForm(
      form({
        autosendPolicyId: "policy_1",
        enabled: "on",
        requireAllRequiredResolved: "on",
        allowDeterministicSource: "on",
        allowFormFieldSource: "on",
        aiEvidenceVerifiedRequired: "on",
        aiMinConfidence: "0,85",
        aiValidationPassedRequired: "on",
        blockIfConflicts: "on",
        blockIfRange: "",
        autoSendConfidence: "0.85",
        draftForReviewConfidence: "0.6",
        aiClassifiedServiceAllowedForAutoSend: "on",
      }),
    );

    assert.equal(result.ok, true);
    assert.deepEqual(buildAutosendPolicyJson(result.value), {
      enabled: true,
      requireAllRequiredResolved: true,
      priceAffectingRequirements: {
        allowSources: ["deterministic", "form_field"],
        aiAllowedIf: {
          evidenceVerified: true,
          minConfidence: 0.85,
          validationPassed: true,
        },
      },
      blockIfConflicts: true,
      blockIfRange: false,
      confidenceBands: {
        autoSend: 0.85,
        draftForReview: 0.6,
      },
      serviceClassification: {
        aiAllowedForAutoSend: true,
      },
    });
  });

  it("uses enabled=false for the safe default policy", () => {
    assert.deepEqual(buildSafeDefaultAutosendPolicyJson(), {
      enabled: false,
      requireAllRequiredResolved: true,
      priceAffectingRequirements: {
        allowSources: ["deterministic", "form_field"],
        aiAllowedIf: {
          evidenceVerified: true,
          minConfidence: 0.85,
          validationPassed: true,
        },
      },
      blockIfConflicts: true,
      blockIfRange: false,
      confidenceBands: {
        autoSend: 0.85,
        draftForReview: 0.6,
      },
      serviceClassification: {
        aiAllowedForAutoSend: false,
      },
    });
  });

  it("treats malformed autosend JSON as unsupported and unsafe", () => {
    assert.deepEqual(
      describeAutosendPolicySupport(buildSafeDefaultAutosendPolicyJson()),
      { supported: true, reason: null },
    );
    assert.equal(
      describeAutosendPolicySupport({
        enabled: true,
        priceAffectingRequirements: { allowSources: ["ai"] },
      }).supported,
      false,
    );
    assert.equal(describeAutosendPolicySupport(null).supported, false);
  });
});

describe("super admin operational response templates", () => {
  it("validates template key and body", () => {
    const result = parseResponseTemplateForm(
      form({
        responseTemplateId: "template_1",
        templateKey: "price_estimate",
        body: "Kaina: {{priceAmount}} {{currency}}",
        active: "on",
      }),
    );

    assert.deepEqual(result, {
      ok: true,
      value: {
        responseTemplateId: "template_1",
        templateKey: "price_estimate",
        body: "Kaina: {{priceAmount}} {{currency}}",
        active: true,
      },
    });
  });

  it("shows placeholder hints and decision-template warnings", () => {
    assert.deepEqual(getAllowedPlaceholders("price_estimate"), [
      "{{priceAmount}}",
      "{{currency}}",
      "{{leadTimeWeeks}}",
    ]);
    assert.match(
      responseTemplateWarningForKey("price_estimate") ?? "",
      /response generation/u,
    );
    assert.equal(responseTemplateWarningForKey("custom_followup"), null);
  });

  it("rejects non slug-like template keys", () => {
    const result = parseResponseTemplateForm(
      form({
        templateKey: "Price Estimate",
        body: "Body",
      }),
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /mažosios/u);
  });
});

describe("super admin operational summary", () => {
  it("counts unsupported operational JSON and active templates", () => {
    assert.deepEqual(
      summarizeOperationalConfig({
        locationZones: [
          {
            id: "zone_1",
            adminUnitCode: "LT-VL",
            zone: "Vilnius",
            travelFeeEur: 0,
            served: true,
          },
        ],
        scheduleRules: [
          {
            id: "schedule_1",
            support: { supported: false, reason: "bad" },
            builder: null,
            rulePreview: "{}",
          },
        ],
        autosendPolicy: {
          id: "policy_1",
          support: { supported: false, reason: "bad" },
          builder: null,
          policyPreview: "{}",
          missing: false,
        },
        responseTemplates: [
          {
            id: "template_1",
            templateKey: "price_estimate",
            body: "Body",
            active: true,
            placeholders: ["{{priceAmount}}"],
            warning: "Warning",
          },
        ],
      }),
      {
        locationZonesCount: 1,
        scheduleRulesCount: 1,
        activeResponseTemplatesCount: 1,
        unsupportedOperationalJsonCount: 2,
      },
    );
  });
});
