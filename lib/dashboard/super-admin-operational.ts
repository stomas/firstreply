import { Prisma } from "@prisma/client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

type FormResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; id?: string | null };

type JsonRecord = Record<string, unknown>;

export type OperationalJsonSupport =
  | { supported: true; reason: null }
  | { supported: false; reason: string };

export type SuperAdminLocationZoneForm = {
  locationZoneId: string | null;
  adminUnitCode: string;
  zone: string;
  travelFeeEur: number;
  served: boolean;
};

export type SuperAdminScheduleRuleForm = {
  scheduleRuleId: string | null;
  minWeeks: number;
  maxWeeks: number;
};

export type SuperAdminAutosendPolicyForm = {
  autosendPolicyId: string | null;
  enabled: boolean;
  requireAllRequiredResolved: boolean;
  allowDeterministicSource: boolean;
  allowFormFieldSource: boolean;
  aiEvidenceVerifiedRequired: boolean;
  aiMinConfidence: number;
  aiValidationPassedRequired: boolean;
  blockIfConflicts: boolean;
  blockIfRange: boolean;
  autoSendConfidence: number;
  draftForReviewConfidence: number;
  aiClassifiedServiceAllowedForAutoSend: boolean;
};

export type SuperAdminResponseTemplateForm = {
  responseTemplateId: string | null;
  templateKey: string;
  body: string;
  active: boolean;
};

export type SuperAdminOperationalSummary = {
  locationZonesCount: number;
  scheduleRulesCount: number;
  activeResponseTemplatesCount: number;
  unsupportedOperationalJsonCount: number;
};

export type SuperAdminLocationZoneRow = {
  id: string;
  adminUnitCode: string;
  zone: string;
  travelFeeEur: number;
  served: boolean;
};

export type SuperAdminScheduleRuleRow = {
  id: string;
  support: OperationalJsonSupport;
  builder: {
    minWeeks: number;
    maxWeeks: number;
  } | null;
  rulePreview: string;
};

export type SuperAdminAutosendPolicyBuilder = Omit<
  SuperAdminAutosendPolicyForm,
  "autosendPolicyId"
>;

export type SuperAdminAutosendPolicyRow = {
  id: string | null;
  support: OperationalJsonSupport;
  builder: SuperAdminAutosendPolicyBuilder | null;
  policyPreview: string;
  missing: boolean;
};

export type SuperAdminResponseTemplateRow = {
  id: string;
  templateKey: string;
  body: string;
  active: boolean;
  placeholders: string[];
  warning: string | null;
};

export type SuperAdminOperationalConfig = {
  tenantId: string | null;
  summary: SuperAdminOperationalSummary;
  locationZones: SuperAdminLocationZoneRow[];
  scheduleRules: SuperAdminScheduleRuleRow[];
  autosendPolicy: SuperAdminAutosendPolicyRow | null;
  responseTemplates: SuperAdminResponseTemplateRow[];
};

const TEMPLATE_KEY_RE = /^[a-z0-9_]+$/u;
const ALLOWED_AUTOSEND_SOURCES = ["deterministic", "form_field"] as const;
const DECISION_TEMPLATE_KEYS = new Set([
  "ask_missing_info",
  "price_estimate",
  "decline_location",
  "offering_answer",
]);

export async function getSuperAdminOperationalConfig(client: {
  id: string;
  tenantId: string | null;
}): Promise<SuperAdminOperationalConfig> {
  assertDatabaseConfigured();

  if (!client.tenantId) {
    return emptyOperationalConfig(null);
  }

  const [locationZones, scheduleRules, autosendPolicies, responseTemplates] =
    await Promise.all([
      prisma.locationZone.findMany({
        where: { tenantId: client.tenantId },
        orderBy: [{ adminUnitCode: "asc" }],
      }),
      prisma.scheduleRule.findMany({
        where: { tenantId: client.tenantId },
        orderBy: [{ createdAt: "asc" }],
      }),
      prisma.autosendPolicy.findMany({
        where: { tenantId: client.tenantId },
        orderBy: [{ createdAt: "asc" }],
        take: 1,
      }),
      prisma.responseTemplate.findMany({
        where: { tenantId: client.tenantId },
        orderBy: [{ active: "desc" }, { templateKey: "asc" }],
      }),
    ]);

  const config = {
    tenantId: client.tenantId,
    locationZones: locationZones.map(toLocationZoneRow),
    scheduleRules: scheduleRules.map(toScheduleRuleRow),
    autosendPolicy: toAutosendPolicyRow(autosendPolicies[0] ?? null),
    responseTemplates: responseTemplates.map(toResponseTemplateRow),
  };

  return {
    ...config,
    summary: summarizeOperationalConfig(config),
  };
}

export function parseLocationZoneForm(
  formData: FormData,
): FormResult<SuperAdminLocationZoneForm> {
  const locationZoneId = nullableTextValue(formData, "locationZoneId");
  const adminUnitCode = textValue(formData, "adminUnitCode");
  if (!adminUnitCode) {
    return {
      ok: false,
      error: "Įveskite admin unit code.",
      id: locationZoneId,
    };
  }

  const zone = textValue(formData, "zone");
  if (!zone) {
    return {
      ok: false,
      error: "Įveskite zonos pavadinimą.",
      id: locationZoneId,
    };
  }

  const travelFeeEur = parseNumberField(formData, "travelFeeEur", 0);
  if (travelFeeEur.error) {
    return { ok: false, error: travelFeeEur.error, id: locationZoneId };
  }
  const travelFeeEurValue = travelFeeEur.value ?? 0;
  if (travelFeeEurValue < 0) {
    return {
      ok: false,
      error: "Kelionės mokestis negali būti neigiamas.",
      id: locationZoneId,
    };
  }

  return {
    ok: true,
    value: {
      locationZoneId,
      adminUnitCode,
      zone,
      travelFeeEur: travelFeeEurValue,
      served: formData.get("served") === "on",
    },
  };
}

export function parseScheduleRuleForm(
  formData: FormData,
): FormResult<SuperAdminScheduleRuleForm> {
  const scheduleRuleId = nullableTextValue(formData, "scheduleRuleId");
  const minWeeks = parseNumberField(formData, "minWeeks");
  const maxWeeks = parseNumberField(formData, "maxWeeks");
  const numberError = minWeeks.error ?? maxWeeks.error;
  if (numberError) {
    return { ok: false, error: numberError, id: scheduleRuleId };
  }
  if (minWeeks.value === null || maxWeeks.value === null) {
    return {
      ok: false,
      error: "Įveskite minimalų ir maksimalų savaičių skaičių.",
      id: scheduleRuleId,
    };
  }
  if (minWeeks.value <= 0 || maxWeeks.value <= 0) {
    return {
      ok: false,
      error: "Savaičių skaičiai turi būti didesni už nulį.",
      id: scheduleRuleId,
    };
  }
  if (minWeeks.value > maxWeeks.value) {
    return {
      ok: false,
      error: "Minimalus terminas negali būti didesnis už maksimalų.",
      id: scheduleRuleId,
    };
  }

  return {
    ok: true,
    value: {
      scheduleRuleId,
      minWeeks: minWeeks.value,
      maxWeeks: maxWeeks.value,
    },
  };
}

export function parseAutosendPolicyForm(
  formData: FormData,
): FormResult<SuperAdminAutosendPolicyForm> {
  const autosendPolicyId = nullableTextValue(formData, "autosendPolicyId");
  const aiMinConfidence = parseNumberField(formData, "aiMinConfidence", 0.85);
  const autoSendConfidence = parseNumberField(
    formData,
    "autoSendConfidence",
    0.85,
  );
  const draftForReviewConfidence = parseNumberField(
    formData,
    "draftForReviewConfidence",
    0.6,
  );
  const numberError =
    aiMinConfidence.error ??
    autoSendConfidence.error ??
    draftForReviewConfidence.error;
  if (numberError) {
    return { ok: false, error: numberError, id: autosendPolicyId };
  }

  const confidenceValues = [
    aiMinConfidence.value,
    autoSendConfidence.value,
    draftForReviewConfidence.value,
  ];
  if (
    confidenceValues.some((value) => value === null || value < 0 || value > 1)
  ) {
    return {
      ok: false,
      error: "Confidence reikšmės turi būti tarp 0 ir 1.",
      id: autosendPolicyId,
    };
  }

  const allowDeterministicSource =
    formData.get("allowDeterministicSource") === "on";
  const allowFormFieldSource = formData.get("allowFormFieldSource") === "on";
  if (!allowDeterministicSource && !allowFormFieldSource) {
    return {
      ok: false,
      error: "Pasirinkite bent vieną leidžiamą price-affecting šaltinį.",
      id: autosendPolicyId,
    };
  }

  return {
    ok: true,
    value: {
      autosendPolicyId,
      enabled: formData.get("enabled") === "on",
      requireAllRequiredResolved:
        formData.get("requireAllRequiredResolved") === "on",
      allowDeterministicSource,
      allowFormFieldSource,
      aiEvidenceVerifiedRequired:
        formData.get("aiEvidenceVerifiedRequired") === "on",
      aiMinConfidence: aiMinConfidence.value ?? 0.85,
      aiValidationPassedRequired:
        formData.get("aiValidationPassedRequired") === "on",
      blockIfConflicts: formData.get("blockIfConflicts") === "on",
      blockIfRange: formData.get("blockIfRange") === "on",
      autoSendConfidence: autoSendConfidence.value ?? 0.85,
      draftForReviewConfidence: draftForReviewConfidence.value ?? 0.6,
      aiClassifiedServiceAllowedForAutoSend:
        formData.get("aiClassifiedServiceAllowedForAutoSend") === "on",
    },
  };
}

export function parseResponseTemplateForm(
  formData: FormData,
): FormResult<SuperAdminResponseTemplateForm> {
  const responseTemplateId = nullableTextValue(formData, "responseTemplateId");
  const templateKey = textValue(formData, "templateKey");
  if (!templateKey) {
    return {
      ok: false,
      error: "Įveskite template key.",
      id: responseTemplateId,
    };
  }
  if (!TEMPLATE_KEY_RE.test(templateKey)) {
    return {
      ok: false,
      error:
        "Template key leidžiamos tik mažosios raidės, skaičiai ir pabraukimai.",
      id: responseTemplateId,
    };
  }

  const body = textValue(formData, "body");
  if (!body) {
    return {
      ok: false,
      error: "Įveskite template tekstą.",
      id: responseTemplateId,
    };
  }

  return {
    ok: true,
    value: {
      responseTemplateId,
      templateKey,
      body,
      active: formData.get("active") === "on",
    },
  };
}

export function buildScheduleRuleJson(
  value: SuperAdminScheduleRuleForm,
): Prisma.InputJsonObject {
  return {
    type: "lead_time_weeks",
    min: value.minWeeks,
    max: value.maxWeeks,
  };
}

export function buildAutosendPolicyJson(
  value: SuperAdminAutosendPolicyForm,
): Prisma.InputJsonObject {
  const allowSources = [
    ...(value.allowDeterministicSource ? ["deterministic"] : []),
    ...(value.allowFormFieldSource ? ["form_field"] : []),
  ];

  return {
    enabled: value.enabled,
    requireAllRequiredResolved: value.requireAllRequiredResolved,
    priceAffectingRequirements: {
      allowSources,
      aiAllowedIf: {
        evidenceVerified: value.aiEvidenceVerifiedRequired,
        minConfidence: value.aiMinConfidence,
        validationPassed: value.aiValidationPassedRequired,
      },
    },
    blockIfConflicts: value.blockIfConflicts,
    blockIfRange: value.blockIfRange,
    confidenceBands: {
      autoSend: value.autoSendConfidence,
      draftForReview: value.draftForReviewConfidence,
    },
    serviceClassification: {
      aiAllowedForAutoSend: value.aiClassifiedServiceAllowedForAutoSend,
    },
  };
}

export function buildSafeDefaultAutosendPolicyJson(): Prisma.InputJsonObject {
  return buildAutosendPolicyJson({
    autosendPolicyId: null,
    enabled: false,
    requireAllRequiredResolved: true,
    allowDeterministicSource: true,
    allowFormFieldSource: true,
    aiEvidenceVerifiedRequired: true,
    aiMinConfidence: 0.85,
    aiValidationPassedRequired: true,
    blockIfConflicts: true,
    blockIfRange: false,
    autoSendConfidence: 0.85,
    draftForReviewConfidence: 0.6,
    aiClassifiedServiceAllowedForAutoSend: false,
  });
}

export function describeScheduleRuleSupport(
  ruleJson: unknown,
): OperationalJsonSupport {
  const rule = asRecord(ruleJson);
  if (!rule) {
    return { supported: false, reason: "Schedule rule JSON nėra objektas." };
  }

  const allowedKeys = new Set(["type", "min", "max"]);
  const unknownKey = Object.keys(rule).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    return {
      supported: false,
      reason: `Laukas „${unknownKey}“ nėra MVP 2 schedule builderio dalis.`,
    };
  }

  if (rule.type !== "lead_time_weeks") {
    return { supported: false, reason: "Nepalaikomas schedule rule tipas." };
  }

  const min = numberValue(rule.min);
  const max = numberValue(rule.max);
  if (min === null || max === null || min <= 0 || max <= 0) {
    return {
      supported: false,
      reason: "lead_time_weeks taisyklei reikia teigiamų min ir max.",
    };
  }
  if (min > max) {
    return {
      supported: false,
      reason: "Schedule min negali būti didesnis už max.",
    };
  }

  return { supported: true, reason: null };
}

export function describeAutosendPolicySupport(
  policyJson: unknown,
): OperationalJsonSupport {
  const policy = asRecord(policyJson);
  if (!policy) {
    return { supported: false, reason: "Autosend policy JSON nėra objektas." };
  }

  const allowedKeys = new Set([
    "enabled",
    "requireAllRequiredResolved",
    "priceAffectingRequirements",
    "blockIfConflicts",
    "blockIfRange",
    "confidenceBands",
    "serviceClassification",
  ]);
  const unknownKey = Object.keys(policy).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    return {
      supported: false,
      reason: `Laukas „${unknownKey}“ nėra MVP 2 autosend builderio dalis.`,
    };
  }

  if (typeof policy.enabled !== "boolean") {
    return { supported: false, reason: "policy.enabled turi būti boolean." };
  }
  if (typeof policy.requireAllRequiredResolved !== "boolean") {
    return {
      supported: false,
      reason: "policy.requireAllRequiredResolved turi būti boolean.",
    };
  }
  if (typeof policy.blockIfConflicts !== "boolean") {
    return {
      supported: false,
      reason: "policy.blockIfConflicts turi būti boolean.",
    };
  }
  if (typeof policy.blockIfRange !== "boolean") {
    return {
      supported: false,
      reason: "policy.blockIfRange turi būti boolean.",
    };
  }

  const pricePolicy = asRecord(policy.priceAffectingRequirements);
  const aiAllowedIf = asRecord(pricePolicy?.aiAllowedIf);
  const allowSources = Array.isArray(pricePolicy?.allowSources)
    ? pricePolicy.allowSources
    : null;
  if (
    !pricePolicy ||
    !allowSources ||
    allowSources.length === 0 ||
    !allowSources.every(
      (source) =>
        typeof source === "string" &&
        ALLOWED_AUTOSEND_SOURCES.some((allowed) => allowed === source),
    )
  ) {
    return {
      supported: false,
      reason:
        "priceAffectingRequirements.allowSources turi būti deterministic/form_field sąrašas.",
    };
  }
  if (
    !aiAllowedIf ||
    typeof aiAllowedIf.evidenceVerified !== "boolean" ||
    typeof aiAllowedIf.validationPassed !== "boolean" ||
    !isConfidence(aiAllowedIf.minConfidence)
  ) {
    return {
      supported: false,
      reason: "priceAffectingRequirements.aiAllowedIf struktūra nepalaikoma.",
    };
  }

  const confidenceBands = asRecord(policy.confidenceBands);
  if (
    !confidenceBands ||
    !isConfidence(confidenceBands.autoSend) ||
    !isConfidence(confidenceBands.draftForReview)
  ) {
    return {
      supported: false,
      reason: "confidenceBands.autoSend/draftForReview turi būti 0-1 skaičiai.",
    };
  }

  const serviceClassification = asRecord(policy.serviceClassification);
  if (
    serviceClassification &&
    typeof serviceClassification.aiAllowedForAutoSend !== "boolean"
  ) {
    return {
      supported: false,
      reason:
        "serviceClassification.aiAllowedForAutoSend turi būti boolean reikšmė.",
    };
  }

  return { supported: true, reason: null };
}

export function summarizeOperationalConfig(config: {
  locationZones: SuperAdminLocationZoneRow[];
  scheduleRules: SuperAdminScheduleRuleRow[];
  autosendPolicy: SuperAdminAutosendPolicyRow | null;
  responseTemplates: SuperAdminResponseTemplateRow[];
}): SuperAdminOperationalSummary {
  return {
    locationZonesCount: config.locationZones.length,
    scheduleRulesCount: config.scheduleRules.length,
    activeResponseTemplatesCount: config.responseTemplates.filter(
      (template) => template.active,
    ).length,
    unsupportedOperationalJsonCount:
      config.scheduleRules.filter((rule) => !rule.support.supported).length +
      (config.autosendPolicy && !config.autosendPolicy.support.supported
        ? 1
        : 0),
  };
}

export function getAllowedPlaceholders(templateKey: string): string[] {
  if (templateKey === "ask_missing_info") {
    return ["{{questions}}"];
  }
  if (templateKey === "price_estimate") {
    return ["{{priceAmount}}", "{{currency}}", "{{leadTimeWeeks}}"];
  }
  if (templateKey === "offering_answer") {
    return ["{{offeringDescription}}", "{{offeringFollowup}}"];
  }
  if (templateKey === "decline_location") {
    return [];
  }
  return [
    "{{questions}}",
    "{{priceAmount}}",
    "{{currency}}",
    "{{leadTimeWeeks}}",
    "{{offeringDescription}}",
    "{{offeringFollowup}}",
  ];
}

export function responseTemplateWarningForKey(
  templateKey: string,
): string | null {
  if (!DECISION_TEMPLATE_KEYS.has(templateKey)) {
    return null;
  }

  return "Šį template key naudoja response generation; deaktyvavus ar palikus tuščią tekstą atsakymo generavimas gali baigtis config klaida.";
}

export async function createSuperAdminLocationZone(
  clientId: string,
  value: SuperAdminLocationZoneForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const duplicate = await prisma.locationZone.findUnique({
    where: {
      tenantId_adminUnitCode: {
        tenantId,
        adminUnitCode: value.adminUnitCode,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Location zone su admin unit code „${value.adminUnitCode}“ jau yra.`,
    };
  }

  await prisma.locationZone.create({
    data: {
      tenantId,
      adminUnitCode: value.adminUnitCode,
      zone: value.zone,
      travelFeeEur: new Prisma.Decimal(value.travelFeeEur),
      served: value.served,
    },
  });

  return { ok: true };
}

export async function updateSuperAdminLocationZone(
  clientId: string,
  value: SuperAdminLocationZoneForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.locationZoneId) {
    return { ok: false, error: "Location zone nerasta." };
  }

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const existing = await prisma.locationZone.findFirst({
    where: { id: value.locationZoneId, tenantId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Location zone nerasta." };
  }

  const duplicate = await prisma.locationZone.findFirst({
    where: {
      tenantId,
      adminUnitCode: value.adminUnitCode,
      NOT: { id: value.locationZoneId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Location zone su admin unit code „${value.adminUnitCode}“ jau yra.`,
    };
  }

  await prisma.locationZone.update({
    where: { id: value.locationZoneId },
    data: {
      adminUnitCode: value.adminUnitCode,
      zone: value.zone,
      travelFeeEur: new Prisma.Decimal(value.travelFeeEur),
      served: value.served,
    },
  });

  return { ok: true };
}

export async function deleteSuperAdminLocationZone(
  clientId: string,
  locationZoneId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const deleted = await prisma.locationZone.deleteMany({
    where: { id: locationZoneId, tenantId },
  });
  return deleted.count > 0
    ? { ok: true }
    : { ok: false, error: "Location zone nerasta." };
}

export async function createSuperAdminScheduleRule(
  clientId: string,
  value: SuperAdminScheduleRuleForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  await prisma.scheduleRule.create({
    data: {
      tenantId,
      rule: buildScheduleRuleJson(value),
    },
  });

  return { ok: true };
}

export async function updateSuperAdminScheduleRule(
  clientId: string,
  value: SuperAdminScheduleRuleForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.scheduleRuleId) {
    return { ok: false, error: "Schedule rule nerasta." };
  }

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const updated = await prisma.scheduleRule.updateMany({
    where: { id: value.scheduleRuleId, tenantId },
    data: { rule: buildScheduleRuleJson(value) },
  });

  return updated.count > 0
    ? { ok: true }
    : { ok: false, error: "Schedule rule nerasta." };
}

export async function deleteSuperAdminScheduleRule(
  clientId: string,
  scheduleRuleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const deleted = await prisma.scheduleRule.deleteMany({
    where: { id: scheduleRuleId, tenantId },
  });
  return deleted.count > 0
    ? { ok: true }
    : { ok: false, error: "Schedule rule nerasta." };
}

export async function saveSuperAdminAutosendPolicy(
  clientId: string,
  value: SuperAdminAutosendPolicyForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const policy = buildAutosendPolicyJson(value);
  if (value.autosendPolicyId) {
    const updated = await prisma.autosendPolicy.updateMany({
      where: { id: value.autosendPolicyId, tenantId },
      data: { policy },
    });
    return updated.count > 0
      ? { ok: true }
      : { ok: false, error: "Autosend policy nerasta." };
  }

  const existing = await prisma.autosendPolicy.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.autosendPolicy.update({
      where: { id: existing.id },
      data: { policy },
    });
    return { ok: true };
  }

  await prisma.autosendPolicy.create({
    data: { tenantId, policy },
  });
  return { ok: true };
}

export async function createSuperAdminResponseTemplate(
  clientId: string,
  value: SuperAdminResponseTemplateForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const duplicate = await prisma.responseTemplate.findUnique({
    where: {
      tenantId_templateKey: {
        tenantId,
        templateKey: value.templateKey,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Response template raktu „${value.templateKey}“ jau yra.`,
    };
  }

  await prisma.responseTemplate.create({
    data: {
      tenantId,
      templateKey: value.templateKey,
      body: value.body,
      active: value.active,
    },
  });

  return { ok: true };
}

export async function updateSuperAdminResponseTemplate(
  clientId: string,
  value: SuperAdminResponseTemplateForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.responseTemplateId) {
    return { ok: false, error: "Response template nerastas." };
  }

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const existing = await prisma.responseTemplate.findFirst({
    where: { id: value.responseTemplateId, tenantId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Response template nerastas." };
  }

  const duplicate = await prisma.responseTemplate.findFirst({
    where: {
      tenantId,
      templateKey: value.templateKey,
      NOT: { id: value.responseTemplateId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Response template raktu „${value.templateKey}“ jau yra.`,
    };
  }

  await prisma.responseTemplate.update({
    where: { id: value.responseTemplateId },
    data: {
      templateKey: value.templateKey,
      body: value.body,
      active: value.active,
    },
  });

  return { ok: true };
}

export async function deactivateSuperAdminResponseTemplate(
  clientId: string,
  responseTemplateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const tenantId = await getClientTenantId(clientId);
  if (!tenantId) {
    return { ok: false, error: "Klientas neturi tenant konteksto." };
  }

  const updated = await prisma.responseTemplate.updateMany({
    where: { id: responseTemplateId, tenantId },
    data: { active: false },
  });
  return updated.count > 0
    ? { ok: true }
    : { ok: false, error: "Response template nerastas." };
}

function emptyOperationalConfig(
  tenantId: string | null,
): SuperAdminOperationalConfig {
  const config = {
    tenantId,
    locationZones: [],
    scheduleRules: [],
    autosendPolicy: null,
    responseTemplates: [],
  };
  return {
    ...config,
    summary: summarizeOperationalConfig(config),
  };
}

function toLocationZoneRow(source: {
  id: string;
  adminUnitCode: string;
  zone: string;
  travelFeeEur: Prisma.Decimal | number;
  served: boolean;
}): SuperAdminLocationZoneRow {
  return {
    id: source.id,
    adminUnitCode: source.adminUnitCode,
    zone: source.zone,
    travelFeeEur: decimalToNumber(source.travelFeeEur),
    served: source.served,
  };
}

function toScheduleRuleRow(source: {
  id: string;
  rule: Prisma.JsonValue;
}): SuperAdminScheduleRuleRow {
  const support = describeScheduleRuleSupport(source.rule);
  const rule = asRecord(source.rule);
  return {
    id: source.id,
    support,
    builder:
      support.supported && rule
        ? {
            minWeeks: numberValue(rule.min) ?? 3,
            maxWeeks: numberValue(rule.max) ?? 5,
          }
        : null,
    rulePreview: prettyJson(source.rule),
  };
}

function toAutosendPolicyRow(
  source: {
    id: string;
    policy: Prisma.JsonValue;
  } | null,
): SuperAdminAutosendPolicyRow {
  if (!source) {
    const policy = buildSafeDefaultAutosendPolicyJson();
    return {
      id: null,
      support: { supported: true, reason: null },
      builder: policyToAutosendBuilder(policy),
      policyPreview: prettyJson(policy),
      missing: true,
    };
  }

  const support = describeAutosendPolicySupport(source.policy);
  return {
    id: source.id,
    support,
    builder: support.supported ? policyToAutosendBuilder(source.policy) : null,
    policyPreview: prettyJson(source.policy),
    missing: false,
  };
}

function toResponseTemplateRow(source: {
  id: string;
  templateKey: string;
  body: string;
  active: boolean;
}): SuperAdminResponseTemplateRow {
  return {
    id: source.id,
    templateKey: source.templateKey,
    body: source.body,
    active: source.active,
    placeholders: getAllowedPlaceholders(source.templateKey),
    warning: responseTemplateWarningForKey(source.templateKey),
  };
}

function policyToAutosendBuilder(
  policyJson: unknown,
): SuperAdminAutosendPolicyBuilder | null {
  const policy = asRecord(policyJson);
  const pricePolicy = asRecord(policy?.priceAffectingRequirements);
  const aiAllowedIf = asRecord(pricePolicy?.aiAllowedIf);
  const confidenceBands = asRecord(policy?.confidenceBands);
  const serviceClassification = asRecord(policy?.serviceClassification);
  const allowSources = Array.isArray(pricePolicy?.allowSources)
    ? pricePolicy.allowSources.filter(
        (source): source is string => typeof source === "string",
      )
    : [];

  if (!policy || !pricePolicy || !aiAllowedIf || !confidenceBands) {
    return null;
  }

  return {
    enabled: policy.enabled === true,
    requireAllRequiredResolved: policy.requireAllRequiredResolved === true,
    allowDeterministicSource: allowSources.includes("deterministic"),
    allowFormFieldSource: allowSources.includes("form_field"),
    aiEvidenceVerifiedRequired: aiAllowedIf.evidenceVerified === true,
    aiMinConfidence: numberValue(aiAllowedIf.minConfidence) ?? 0.85,
    aiValidationPassedRequired: aiAllowedIf.validationPassed === true,
    blockIfConflicts: policy.blockIfConflicts === true,
    blockIfRange: policy.blockIfRange === true,
    autoSendConfidence: numberValue(confidenceBands.autoSend) ?? 0.85,
    draftForReviewConfidence:
      numberValue(confidenceBands.draftForReview) ?? 0.6,
    aiClassifiedServiceAllowedForAutoSend:
      serviceClassification?.aiAllowedForAutoSend === true,
  };
}

async function getClientTenantId(clientId: string): Promise<string | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true },
  });
  return client?.tenantId ?? null;
}

function parseNumberField(
  formData: FormData,
  key: string,
  defaultValue?: number,
): { value: number | null; error?: string } {
  const raw = textValue(formData, key);
  if (!raw) {
    return defaultValue === undefined
      ? { value: null }
      : { value: defaultValue };
  }

  const value = parseFiniteNumber(raw);
  if (value === null) {
    return { value: null, error: `Laukas „${key}“ turi būti skaičius.` };
  }

  return { value };
}

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableTextValue(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value ? value : null;
}

function parseFiniteNumber(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function decimalToNumber(value: Prisma.Decimal | number): number {
  return Number(value);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}
