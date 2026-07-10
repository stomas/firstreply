import { Prisma } from "@prisma/client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
export { isSuperAdminEnabled } from "@/lib/dashboard/super-admin-access";

type FormResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; id?: string | null; serviceId?: string | null };

type JsonRecord = Record<string, unknown>;

export type SuperAdminServiceForm = {
  name: string;
  label: string | null;
  keywords: string[];
  active: boolean;
};

export type SuperAdminSubjectForm = {
  serviceId: string;
  subjectId: string | null;
  subjectKey: string;
  labelLt: string;
  descriptionLt: string;
  synonyms: string[];
};

export type SuperAdminAdvancedRequirementForm = {
  serviceId: string;
  requirementId: string | null;
  requirementKey: string;
  label: string;
  question: string;
  expectedKind: "measurement";
  subjectKey: string | null;
  dimension: RequirementDimension;
  units: string[];
  validationMin: number | null;
  validationMax: number | null;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
};

export type SuperAdminPricingModifier = {
  requirementKey: string;
  gte: number;
  pricePerUnitDelta: number;
};

export type SuperAdminPricingBuilderForm = {
  serviceId: string;
  pricingRuleId: string | null;
  name: string;
  ruleType: SupportedPricingRuleType;
  requirementKey: string;
  ruleUnit: string;
  currency: string;
  pricePerUnit: number | null;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  requires: string[];
  modifiers: SuperAdminPricingModifier[];
  autoSendAllowed: boolean;
  active: boolean;
  disclaimerText: string | null;
};

export type SuperAdminSummary = {
  servicesCount: number;
  subjectsCount: number;
  activeRequirementsCount: number;
  activePricingRulesCount: number;
  unsupportedJsonCount: number;
  brokenReferencesCount: number;
};

export type SuperAdminSubjectRow = {
  id: string;
  serviceId: string;
  subjectKey: string;
  labelLt: string;
  descriptionLt: string;
  synonyms: string[];
  rawJsonPreview: string;
};

export type SuperAdminRequirementRow = {
  id: string;
  serviceId: string;
  requirementKey: string;
  label: string;
  question: string;
  expectedKind: string;
  subjectKey: string | null;
  dimension: string;
  units: string[];
  validationMin: number | null;
  validationMax: number | null;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  expectedFactSupported: boolean;
  expectedFactPreview: string;
  validationPreview: string;
};

export type SuperAdminPricingRuleRow = {
  id: string;
  serviceId: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  autoSendAllowed: boolean;
  active: boolean;
  disclaimerText: string | null;
  support: PricingRuleSupport;
  builder: {
    ruleType: SupportedPricingRuleType;
    requirementKey: string;
    ruleUnit: string;
    currency: string;
    pricePerUnit: number | null;
    requiresText: string;
    modifiers: SuperAdminPricingModifier[];
  } | null;
  rulePreview: string;
};

export type SuperAdminServiceGroup = {
  serviceId: string;
  serviceName: string;
  serviceActive: boolean;
  subjects: SuperAdminSubjectRow[];
  requirements: SuperAdminRequirementRow[];
  pricingRules: SuperAdminPricingRuleRow[];
};

export type SuperAdminConfig = {
  summary: SuperAdminSummary;
  groups: SuperAdminServiceGroup[];
};

export type PricingRuleSupport =
  | { supported: true; reason: null }
  | { supported: false; reason: string };

type RequirementDimension = (typeof REQUIREMENT_DIMENSIONS)[number];
type SupportedPricingRuleType = (typeof SUPPORTED_PRICING_RULE_TYPES)[number];

const SUBJECT_KEY_RE = /^[a-z0-9_]+$/u;
const REQUIREMENT_KEY_RE = /^[a-z0-9_]+$/u;
const REQUIREMENT_DIMENSIONS = ["length", "height", "width", "area"] as const;
const SUPPORTED_PRICING_RULE_TYPES = ["per_unit", "range_estimate"] as const;
const DEFAULT_CURRENCY = "EUR";
const MAX_MODIFIER_ROWS = 5;

export async function getSuperAdminConfig(
  clientId: string,
): Promise<SuperAdminConfig> {
  assertDatabaseConfigured();

  const services = await prisma.service.findMany({
    where: { clientId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      subjects: {
        orderBy: [{ subjectKey: "asc" }],
      },
      decisionRequirements: {
        orderBy: [
          { active: "desc" },
          { priority: "asc" },
          { createdAt: "asc" },
        ],
      },
      pricingRules: {
        orderBy: [{ active: "desc" }, { name: "asc" }],
      },
    },
  });

  const groups = services.map((service) => ({
    serviceId: service.id,
    serviceName: service.name,
    serviceActive: service.active,
    subjects: service.subjects.map(toSubjectRow),
    requirements: service.decisionRequirements.map(toRequirementRow),
    pricingRules: service.pricingRules.map(toPricingRuleRow),
  }));

  return {
    summary: summarizeSuperAdminConfig(groups),
    groups,
  };
}

export function summarizeSuperAdminConfig(
  groups: SuperAdminServiceGroup[],
): SuperAdminSummary {
  return {
    servicesCount: groups.length,
    subjectsCount: groups.reduce(
      (count, group) => count + group.subjects.length,
      0,
    ),
    activeRequirementsCount: groups.reduce(
      (count, group) =>
        count +
        group.requirements.filter((requirement) => requirement.active).length,
      0,
    ),
    activePricingRulesCount: groups.reduce(
      (count, group) =>
        count + group.pricingRules.filter((rule) => rule.active).length,
      0,
    ),
    unsupportedJsonCount: groups.reduce(
      (count, group) =>
        count +
        group.pricingRules.filter((rule) => !rule.support.supported).length +
        group.requirements.filter(
          (requirement) => !requirement.expectedFactSupported,
        ).length,
      0,
    ),
    brokenReferencesCount: groups.reduce(
      (count, group) => count + countBrokenReferences(group),
      0,
    ),
  };
}

export function parseSuperAdminServiceForm(
  formData: FormData,
): FormResult<SuperAdminServiceForm> {
  const name = textValue(formData, "name");
  if (!name) {
    return { ok: false, error: "Įveskite paslaugos pavadinimą." };
  }

  return {
    ok: true,
    value: {
      name,
      label: nullableTextValue(formData, "label"),
      keywords: splitList(textValue(formData, "keywords")),
      active: formData.get("active") === "on",
    },
  };
}

export function parseSubjectForm(
  formData: FormData,
): FormResult<SuperAdminSubjectForm> {
  const serviceId = textValue(formData, "serviceId");
  const subjectId = nullableTextValue(formData, "subjectId");
  if (!serviceId) {
    return { ok: false, error: "Paslauga nerasta.", serviceId: null };
  }

  const subjectKey = textValue(formData, "subjectKey");
  if (!subjectKey) {
    return { ok: false, error: "Įveskite temos raktą.", serviceId };
  }
  if (!SUBJECT_KEY_RE.test(subjectKey)) {
    return {
      ok: false,
      error:
        "Temos raktui leidžiamos tik mažosios raidės, skaičiai ir pabraukimai.",
      serviceId,
      id: subjectId,
    };
  }

  const labelLt = textValue(formData, "labelLt");
  if (!labelLt) {
    return { ok: false, error: "Įveskite temos pavadinimą.", serviceId };
  }

  const descriptionLt = textValue(formData, "descriptionLt");
  if (!descriptionLt) {
    return { ok: false, error: "Įveskite temos aprašymą.", serviceId };
  }

  return {
    ok: true,
    value: {
      serviceId,
      subjectId,
      subjectKey,
      labelLt,
      descriptionLt,
      synonyms: splitList(textValue(formData, "synonyms")),
    },
  };
}

export function parseAdvancedRequirementForm(
  formData: FormData,
): FormResult<SuperAdminAdvancedRequirementForm> {
  const serviceId = textValue(formData, "serviceId");
  const requirementId = nullableTextValue(formData, "requirementId");
  if (!serviceId) {
    return { ok: false, error: "Paslauga nerasta.", serviceId: null };
  }

  const requirementKey = textValue(formData, "requirementKey");
  if (!requirementKey) {
    return { ok: false, error: "Įveskite klausimo raktą.", serviceId };
  }
  if (!REQUIREMENT_KEY_RE.test(requirementKey)) {
    return {
      ok: false,
      error:
        "Klausimo raktui naudokite tik mažąsias raides, skaičius ir pabraukimus.",
      serviceId,
      id: requirementId,
    };
  }

  const label = textValue(formData, "label");
  if (!label) {
    return { ok: false, error: "Įveskite klausimo pavadinimą.", serviceId };
  }

  const question = textValue(formData, "question");
  if (!question) {
    return { ok: false, error: "Įveskite klausimo tekstą.", serviceId };
  }

  if (textValue(formData, "expectedKind") !== "measurement") {
    return {
      ok: false,
      error: "MVP 1 palaiko tik expectedFact.kind=measurement.",
      serviceId,
      id: requirementId,
    };
  }

  const dimension = textValue(formData, "dimension");
  if (!isRequirementDimension(dimension)) {
    return { ok: false, error: "Pasirinkite palaikomą matmenį.", serviceId };
  }

  const units = splitList(textValue(formData, "units"));
  if (units.length === 0) {
    return {
      ok: false,
      error: "Įveskite bent vieną matavimo vienetą.",
      serviceId,
      id: requirementId,
    };
  }

  const priority = parseNumberField(formData, "priority");
  const validationMin = parseNumberField(formData, "validationMin");
  const validationMax = parseNumberField(formData, "validationMax");
  const numberError =
    priority.error ?? validationMin.error ?? validationMax.error;
  if (numberError) {
    return { ok: false, error: numberError, serviceId, id: requirementId };
  }

  if (
    validationMin.value !== null &&
    validationMax.value !== null &&
    validationMin.value > validationMax.value
  ) {
    return {
      ok: false,
      error: "Riba „nuo“ negali būti didesnė už ribą „iki“.",
      serviceId,
      id: requirementId,
    };
  }

  return {
    ok: true,
    value: {
      serviceId,
      requirementId,
      requirementKey,
      label,
      question,
      expectedKind: "measurement",
      subjectKey: nullableTextValue(formData, "subjectKey"),
      dimension,
      units,
      validationMin: validationMin.value,
      validationMax: validationMax.value,
      required: formData.get("required") === "on",
      affectsPrice: formData.get("affectsPrice") === "on",
      active: formData.get("active") === "on",
      priority: priority.value !== null ? Math.round(priority.value) : 100,
    },
  };
}

export function parsePricingBuilderForm(
  formData: FormData,
): FormResult<SuperAdminPricingBuilderForm> {
  const serviceId = textValue(formData, "serviceId");
  const pricingRuleId = nullableTextValue(formData, "pricingRuleId");
  if (!serviceId) {
    return { ok: false, error: "Paslauga nerasta.", serviceId: null };
  }

  const name = textValue(formData, "name");
  if (!name) {
    return { ok: false, error: "Įveskite kainodaros pavadinimą.", serviceId };
  }

  const ruleType = textValue(formData, "ruleType");
  if (!isSupportedPricingRuleType(ruleType)) {
    return {
      ok: false,
      error: "Pasirinkite palaikomą kainodaros tipą.",
      serviceId,
      id: pricingRuleId,
    };
  }

  const requirementKey = textValue(formData, "requirementKey");
  if (!requirementKey) {
    return {
      ok: false,
      error: "Pasirinkite pagrindinį requirementKey.",
      serviceId,
      id: pricingRuleId,
    };
  }

  const ruleUnit = textValue(formData, "ruleUnit") || "m";
  const currency = textValue(formData, "currency") || DEFAULT_CURRENCY;
  const pricePerUnit = parseNumberField(formData, "pricePerUnit");
  const priceMin = parseNumberField(formData, "priceMin");
  const priceMax = parseNumberField(formData, "priceMax");
  const numberError = pricePerUnit.error ?? priceMin.error ?? priceMax.error;
  if (numberError) {
    return { ok: false, error: numberError, serviceId, id: pricingRuleId };
  }

  if (ruleType === "per_unit") {
    if (pricePerUnit.value === null) {
      return {
        ok: false,
        error: "Įveskite vieneto kainą.",
        serviceId,
        id: pricingRuleId,
      };
    }
    if (pricePerUnit.value <= 0) {
      return {
        ok: false,
        error: "Vieneto kaina turi būti didesnė už nulį.",
        serviceId,
        id: pricingRuleId,
      };
    }
  }

  if (
    priceMin.value !== null &&
    priceMax.value !== null &&
    priceMin.value > priceMax.value
  ) {
    return {
      ok: false,
      error: "Kaina „nuo“ negali būti didesnė už kainą „iki“.",
      serviceId,
      id: pricingRuleId,
    };
  }

  const modifierResult = parseModifierRows(formData);
  if (!modifierResult.ok) {
    return {
      ok: false,
      error: modifierResult.error,
      serviceId,
      id: pricingRuleId,
    };
  }

  return {
    ok: true,
    value: {
      serviceId,
      pricingRuleId,
      name,
      ruleType,
      requirementKey,
      ruleUnit,
      currency,
      pricePerUnit: ruleType === "per_unit" ? pricePerUnit.value : null,
      priceMin: priceMin.value,
      priceMax: priceMax.value,
      unit: nullableTextValue(formData, "unit"),
      requires: splitFormList(formData, "requires"),
      modifiers: ruleType === "per_unit" ? modifierResult.value : [],
      autoSendAllowed: formData.get("autoSendAllowed") === "on",
      active: formData.get("active") === "on",
      disclaimerText: nullableTextValue(formData, "disclaimerText"),
    },
  };
}

export function buildExpectedFactJson(
  value: SuperAdminAdvancedRequirementForm,
): Prisma.InputJsonObject {
  return {
    kind: "measurement",
    ...(value.subjectKey ? { subject: value.subjectKey } : {}),
    dimension: value.dimension,
    units: value.units,
  };
}

export function buildValidationJson(
  value: SuperAdminAdvancedRequirementForm,
): Prisma.InputJsonObject | typeof Prisma.JsonNull {
  const validation: JsonRecord = {};
  if (value.validationMin !== null) {
    validation.min = value.validationMin;
  }
  if (value.validationMax !== null) {
    validation.max = value.validationMax;
  }
  return Object.keys(validation).length > 0
    ? (validation as Prisma.InputJsonObject)
    : Prisma.JsonNull;
}

export function buildPricingRuleJson(
  value: SuperAdminPricingBuilderForm,
): Prisma.InputJsonObject {
  const requires = uniqueList([value.requirementKey, ...value.requires]);
  const rule: JsonRecord = {
    type: value.ruleType,
    requirementKey: value.requirementKey,
    unit: value.ruleUnit,
    currency: value.currency,
    requires,
  };

  if (value.ruleType === "per_unit") {
    rule.pricePerUnit = value.pricePerUnit;
    if (value.modifiers.length > 0) {
      rule.modifiers = value.modifiers.map((modifier) => ({
        if: {
          requirementKey: modifier.requirementKey,
          gte: modifier.gte,
        },
        pricePerUnitDelta: modifier.pricePerUnitDelta,
      }));
    }
  }

  return rule as Prisma.InputJsonObject;
}

export function describePricingRuleSupport(
  ruleJson: unknown,
): PricingRuleSupport {
  const rule = asRecord(ruleJson);
  if (!rule) {
    return { supported: false, reason: "Taisyklės JSON nėra objektas." };
  }

  const type = rule.type;
  if (type !== "per_unit" && type !== "range_estimate") {
    return { supported: false, reason: "Nepalaikomas kainodaros tipas." };
  }

  const allowedKeys =
    type === "per_unit"
      ? new Set([
          "type",
          "requirementKey",
          "unit",
          "currency",
          "requires",
          "pricePerUnit",
          "modifiers",
        ])
      : new Set(["type", "requirementKey", "unit", "currency", "requires"]);
  const unknownKey = Object.keys(rule).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    return {
      supported: false,
      reason: `Laukas „${unknownKey}“ nėra MVP 1 builderio dalis.`,
    };
  }

  if (typeof rule.requirementKey !== "string" || !rule.requirementKey.trim()) {
    return { supported: false, reason: "Trūksta rule.requirementKey." };
  }

  if (typeof rule.unit !== "string" || !rule.unit.trim()) {
    return { supported: false, reason: "Trūksta rule.unit." };
  }

  if (
    "currency" in rule &&
    (typeof rule.currency !== "string" || !rule.currency.trim())
  ) {
    return { supported: false, reason: "rule.currency turi būti tekstas." };
  }

  if (
    "requires" in rule &&
    (!Array.isArray(rule.requires) ||
      !rule.requires.every((key) => typeof key === "string" && key.trim()))
  ) {
    return {
      supported: false,
      reason: "rule.requires turi būti raktų sąrašas.",
    };
  }

  if (type === "range_estimate") {
    return { supported: true, reason: null };
  }

  if (typeof rule.pricePerUnit !== "number" || rule.pricePerUnit <= 0) {
    return {
      supported: false,
      reason: "per_unit taisyklei reikia teigiamos rule.pricePerUnit.",
    };
  }

  if (!("modifiers" in rule)) {
    return { supported: true, reason: null };
  }

  if (!Array.isArray(rule.modifiers)) {
    return { supported: false, reason: "rule.modifiers turi būti sąrašas." };
  }

  const invalidModifier = rule.modifiers.find(
    (modifier) => !isSupportedModifier(modifier),
  );
  if (invalidModifier) {
    return {
      supported: false,
      reason: "Vienas iš rule.modifiers neatitinka MVP 1 struktūros.",
    };
  }

  return { supported: true, reason: null };
}

export function getUnsupportedPricingRuleCount(
  rules: Array<{ rule: unknown }>,
): number {
  return rules.filter(
    (rule) => !describePricingRuleSupport(rule.rule).supported,
  ).length;
}

export function subjectDeleteBlockedByRequirements(
  subjectKey: string,
  requirements: Array<{ active: boolean; expectedFact: unknown }>,
): boolean {
  return requirements.some((requirement) => {
    const expectedFact = asRecord(requirement.expectedFact);
    return requirement.active && expectedFact?.subject === subjectKey;
  });
}

export function isRequirementKeyReferenced(
  requirementKey: string,
  pricingRules: Array<{ active: boolean; rule: unknown }>,
): boolean {
  return pricingRules.some(
    (pricingRule) =>
      pricingRule.active &&
      requirementKeyInRule(requirementKey, pricingRule.rule),
  );
}

export async function createSuperAdminService(
  clientId: string,
  value: SuperAdminServiceForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true },
  });
  if (!client) {
    return { ok: false, error: "Klientas nerastas." };
  }

  const duplicate = await prisma.service.findFirst({
    where: {
      clientId,
      name: { equals: value.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Paslauga pavadinimu „${value.name}“ šiam klientui jau yra.`,
    };
  }

  await prisma.service.create({
    data: {
      clientId,
      tenantId: client.tenantId,
      name: value.name,
      label: value.label,
      keywords: value.keywords as Prisma.InputJsonArray,
      active: value.active,
    },
  });

  return { ok: true };
}

export async function deleteSuperAdminService(
  clientId: string,
  serviceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const deleted = await prisma.service.deleteMany({
    where: { id: serviceId, clientId },
  });
  if (deleted.count === 0) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  return { ok: true };
}

export async function createSuperAdminSubject(
  clientId: string,
  value: SuperAdminSubjectForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const service = await findClientService(clientId, value.serviceId);
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  const duplicate = await prisma.serviceSubject.findUnique({
    where: {
      serviceId_subjectKey: {
        serviceId: value.serviceId,
        subjectKey: value.subjectKey,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Tema su raktu „${value.subjectKey}“ šiai paslaugai jau yra.`,
    };
  }

  await prisma.serviceSubject.create({
    data: {
      serviceId: value.serviceId,
      subjectKey: value.subjectKey,
      labelLt: value.labelLt,
      descriptionLt: value.descriptionLt,
      synonyms: value.synonyms as Prisma.InputJsonArray,
    },
  });

  return { ok: true };
}

export async function updateSuperAdminSubject(
  clientId: string,
  value: SuperAdminSubjectForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.subjectId) {
    return { ok: false, error: "Tema nerasta." };
  }

  const existing = await prisma.serviceSubject.findFirst({
    where: {
      id: value.subjectId,
      service: { clientId },
    },
    select: {
      id: true,
      serviceId: true,
      subjectKey: true,
    },
  });
  if (!existing) {
    return { ok: false, error: "Tema nerasta." };
  }

  const service = await findClientService(clientId, value.serviceId);
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  if (
    (existing.subjectKey !== value.subjectKey ||
      existing.serviceId !== value.serviceId) &&
    (await subjectHasRequirementReferences(
      clientId,
      existing.serviceId,
      existing.subjectKey,
    ))
  ) {
    return {
      ok: false,
      error:
        "Temos rakto ar paslaugos pakeisti negalima — aktyvus klausimas dar naudoja seną temą.",
    };
  }

  const duplicate = await prisma.serviceSubject.findFirst({
    where: {
      serviceId: value.serviceId,
      subjectKey: value.subjectKey,
      NOT: { id: value.subjectId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Tema su raktu „${value.subjectKey}“ šiai paslaugai jau yra.`,
    };
  }

  await prisma.serviceSubject.update({
    where: { id: value.subjectId },
    data: {
      serviceId: value.serviceId,
      subjectKey: value.subjectKey,
      labelLt: value.labelLt,
      descriptionLt: value.descriptionLt,
      synonyms: value.synonyms as Prisma.InputJsonArray,
    },
  });

  return { ok: true };
}

export async function deleteSuperAdminSubject(
  clientId: string,
  subjectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const subject = await prisma.serviceSubject.findFirst({
    where: { id: subjectId, service: { clientId } },
    select: { id: true, serviceId: true, subjectKey: true },
  });
  if (!subject) {
    return { ok: false, error: "Tema nerasta." };
  }

  if (
    await subjectHasRequirementReferences(
      clientId,
      subject.serviceId,
      subject.subjectKey,
    )
  ) {
    return {
      ok: false,
      error:
        "Temos ištrinti negalima — ją naudoja aktyvus klausimas. Pirmiausia pakeiskite arba deaktyvuokite klausimą.",
    };
  }

  await prisma.serviceSubject.delete({ where: { id: subject.id } });
  return { ok: true };
}

export async function createSuperAdminRequirement(
  clientId: string,
  value: SuperAdminAdvancedRequirementForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const validation = await validateRequirementReferences(clientId, value);
  if (!validation.ok) {
    return validation;
  }

  const duplicate = await prisma.decisionRequirement.findFirst({
    where: {
      clientId,
      serviceId: value.serviceId,
      requirementKey: value.requirementKey,
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Klausimas raktu „${value.requirementKey}“ šiai paslaugai jau yra.`,
    };
  }

  await prisma.decisionRequirement.create({
    data: {
      clientId,
      serviceId: value.serviceId,
      requirementKey: value.requirementKey,
      label: value.label,
      requiredFor: "auto_send",
      questionTextIfMissing: value.question,
      blocksAutoSend: value.required,
      priority: value.priority,
      active: value.active,
      required: value.required,
      affectsPrice: value.affectsPrice,
      expectedFact: buildExpectedFactJson(value),
      validation: buildValidationJson(value),
    },
  });

  return { ok: true };
}

export async function updateSuperAdminRequirement(
  clientId: string,
  value: SuperAdminAdvancedRequirementForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.requirementId) {
    return { ok: false, error: "Klausimas nerastas." };
  }

  const existing = await prisma.decisionRequirement.findFirst({
    where: { id: value.requirementId, clientId },
    select: {
      id: true,
      serviceId: true,
      requirementKey: true,
      active: true,
    },
  });
  if (!existing) {
    return { ok: false, error: "Klausimas nerastas." };
  }

  const validation = await validateRequirementReferences(clientId, value);
  if (!validation.ok) {
    return validation;
  }

  const keyOrServiceChanged =
    existing.requirementKey !== value.requirementKey ||
    existing.serviceId !== value.serviceId;
  if (
    (keyOrServiceChanged || (existing.active && !value.active)) &&
    (await requirementHasPricingReferences(
      clientId,
      existing.serviceId,
      existing.requirementKey,
    ))
  ) {
    return {
      ok: false,
      error:
        "Klausimo rakto, paslaugos arba aktyvumo pakeisti negalima — aktyvi kainodaros taisyklė dar naudoja seną raktą.",
    };
  }

  const duplicate = await prisma.decisionRequirement.findFirst({
    where: {
      clientId,
      serviceId: value.serviceId,
      requirementKey: value.requirementKey,
      NOT: { id: value.requirementId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Klausimas raktu „${value.requirementKey}“ šiai paslaugai jau yra.`,
    };
  }

  await prisma.decisionRequirement.update({
    where: { id: value.requirementId },
    data: {
      serviceId: value.serviceId,
      requirementKey: value.requirementKey,
      label: value.label,
      questionTextIfMissing: value.question,
      blocksAutoSend: value.required,
      priority: value.priority,
      active: value.active,
      required: value.required,
      affectsPrice: value.affectsPrice,
      expectedFact: buildExpectedFactJson(value),
      validation: buildValidationJson(value),
    },
  });

  return { ok: true };
}

export async function deactivateSuperAdminRequirement(
  clientId: string,
  requirementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const requirement = await prisma.decisionRequirement.findFirst({
    where: { id: requirementId, clientId },
    select: { id: true, serviceId: true, requirementKey: true, active: true },
  });
  if (!requirement) {
    return { ok: false, error: "Klausimas nerastas." };
  }

  if (
    requirement.active &&
    (await requirementHasPricingReferences(
      clientId,
      requirement.serviceId,
      requirement.requirementKey,
    ))
  ) {
    return {
      ok: false,
      error:
        "Klausimo deaktyvuoti negalima — aktyvi kainodaros taisyklė dar naudoja šį raktą.",
    };
  }

  await prisma.decisionRequirement.update({
    where: { id: requirement.id },
    data: { active: false },
  });
  return { ok: true };
}

export async function createSuperAdminPricingRule(
  clientId: string,
  value: SuperAdminPricingBuilderForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const validation = await validatePricingReferences(clientId, value);
  if (!validation.ok) {
    return validation;
  }

  await prisma.pricingRule.create({
    data: {
      clientId,
      serviceId: value.serviceId,
      name: value.name,
      priceMin: value.priceMin,
      priceMax: value.priceMax,
      unit: value.unit,
      autoSendAllowed: value.autoSendAllowed,
      active: value.active,
      disclaimerText: value.disclaimerText,
      rule: buildPricingRuleJson(value),
    },
  });

  return { ok: true };
}

export async function updateSuperAdminPricingRule(
  clientId: string,
  value: SuperAdminPricingBuilderForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  if (!value.pricingRuleId) {
    return { ok: false, error: "Kainodaros taisyklė nerasta." };
  }

  const existing = await prisma.pricingRule.findFirst({
    where: { id: value.pricingRuleId, clientId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Kainodaros taisyklė nerasta." };
  }

  const validation = await validatePricingReferences(clientId, value);
  if (!validation.ok) {
    return validation;
  }

  await prisma.pricingRule.update({
    where: { id: value.pricingRuleId },
    data: {
      serviceId: value.serviceId,
      name: value.name,
      priceMin: value.priceMin,
      priceMax: value.priceMax,
      unit: value.unit,
      autoSendAllowed: value.autoSendAllowed,
      active: value.active,
      disclaimerText: value.disclaimerText,
      rule: buildPricingRuleJson(value),
    },
  });

  return { ok: true };
}

export async function deactivateSuperAdminPricingRule(
  clientId: string,
  pricingRuleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const updated = await prisma.pricingRule.updateMany({
    where: { id: pricingRuleId, clientId },
    data: { active: false },
  });

  return updated.count > 0
    ? { ok: true }
    : { ok: false, error: "Kainodaros taisyklė nerasta." };
}

function toSubjectRow(source: {
  id: string;
  serviceId: string;
  subjectKey: string;
  labelLt: string;
  descriptionLt: string;
  synonyms: Prisma.JsonValue;
}): SuperAdminSubjectRow {
  const synonyms = Array.isArray(source.synonyms)
    ? source.synonyms.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return {
    id: source.id,
    serviceId: source.serviceId,
    subjectKey: source.subjectKey,
    labelLt: source.labelLt,
    descriptionLt: source.descriptionLt,
    synonyms,
    rawJsonPreview: prettyJson({ synonyms }),
  };
}

function toRequirementRow(source: {
  id: string;
  serviceId: string;
  requirementKey: string;
  label: string;
  questionTextIfMissing: string;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  expectedFact: Prisma.JsonValue;
  validation: Prisma.JsonValue;
}): SuperAdminRequirementRow {
  const expectedFact = asRecord(source.expectedFact);
  const validation = asRecord(source.validation);
  const units = Array.isArray(expectedFact?.units)
    ? expectedFact.units.filter(
        (unit): unit is string => typeof unit === "string",
      )
    : [];

  return {
    id: source.id,
    serviceId: source.serviceId,
    requirementKey: source.requirementKey,
    label: source.label,
    question: source.questionTextIfMissing,
    expectedKind:
      typeof expectedFact?.kind === "string"
        ? expectedFact.kind
        : "measurement",
    subjectKey:
      typeof expectedFact?.subject === "string" ? expectedFact.subject : null,
    dimension:
      typeof expectedFact?.dimension === "string"
        ? expectedFact.dimension
        : "length",
    units,
    validationMin: typeof validation?.min === "number" ? validation.min : null,
    validationMax: typeof validation?.max === "number" ? validation.max : null,
    required: source.required,
    affectsPrice: source.affectsPrice,
    active: source.active,
    priority: source.priority,
    expectedFactSupported: isSupportedExpectedFact(expectedFact),
    expectedFactPreview: prettyJson(source.expectedFact),
    validationPreview: prettyJson(source.validation),
  };
}

function toPricingRuleRow(source: {
  id: string;
  serviceId: string;
  name: string;
  priceMin: Prisma.Decimal | number | null;
  priceMax: Prisma.Decimal | number | null;
  unit: string | null;
  autoSendAllowed: boolean;
  active: boolean;
  disclaimerText: string | null;
  rule: Prisma.JsonValue;
}): SuperAdminPricingRuleRow {
  const support = describePricingRuleSupport(source.rule);
  const rule = asRecord(source.rule);
  const builder =
    support.supported && rule
      ? {
          ruleType: rule.type as SupportedPricingRuleType,
          requirementKey: stringValue(rule.requirementKey) ?? "",
          ruleUnit: stringValue(rule.unit) ?? "m",
          currency: stringValue(rule.currency) ?? DEFAULT_CURRENCY,
          pricePerUnit: numberValue(rule.pricePerUnit),
          requiresText: Array.isArray(rule.requires)
            ? rule.requires
                .filter((key): key is string => typeof key === "string")
                .join(", ")
            : (stringValue(rule.requirementKey) ?? ""),
          modifiers: parseSupportedModifiers(rule.modifiers),
        }
      : null;

  return {
    id: source.id,
    serviceId: source.serviceId,
    name: source.name,
    priceMin: decimalToNumber(source.priceMin),
    priceMax: decimalToNumber(source.priceMax),
    unit: source.unit,
    autoSendAllowed: source.autoSendAllowed,
    active: source.active,
    disclaimerText: source.disclaimerText,
    support,
    builder,
    rulePreview: prettyJson(source.rule),
  };
}

function countBrokenReferences(group: SuperAdminServiceGroup): number {
  const activeSubjects = new Set(
    group.subjects.map((subject) => subject.subjectKey),
  );
  const activeRequirementKeys = new Set(
    group.requirements
      .filter((requirement) => requirement.active)
      .map((requirement) => requirement.requirementKey),
  );

  let broken = 0;
  for (const requirement of group.requirements) {
    if (
      requirement.active &&
      requirement.subjectKey &&
      !activeSubjects.has(requirement.subjectKey)
    ) {
      broken += 1;
    }
  }

  for (const pricingRule of group.pricingRules) {
    if (!pricingRule.active || !pricingRule.builder) {
      continue;
    }
    const referencedKeys = uniqueList([
      pricingRule.builder.requirementKey,
      ...splitList(pricingRule.builder.requiresText),
      ...pricingRule.builder.modifiers.map(
        (modifier) => modifier.requirementKey,
      ),
    ]);
    broken += referencedKeys.filter(
      (key) => !activeRequirementKeys.has(key),
    ).length;
  }

  return broken;
}

function isSupportedExpectedFact(expectedFact: JsonRecord | null): boolean {
  if (!expectedFact) {
    return false;
  }
  if (expectedFact.kind !== "measurement") {
    return false;
  }
  if (
    "subject" in expectedFact &&
    expectedFact.subject !== null &&
    typeof expectedFact.subject !== "string"
  ) {
    return false;
  }
  if (
    typeof expectedFact.dimension !== "string" ||
    !isRequirementDimension(expectedFact.dimension)
  ) {
    return false;
  }
  return (
    Array.isArray(expectedFact.units) &&
    expectedFact.units.length > 0 &&
    expectedFact.units.every((unit) => typeof unit === "string" && unit.trim())
  );
}

async function validateRequirementReferences(
  clientId: string,
  value: SuperAdminAdvancedRequirementForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = await findClientService(clientId, value.serviceId);
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  if (!value.subjectKey) {
    return { ok: true };
  }

  const subject = await prisma.serviceSubject.findUnique({
    where: {
      serviceId_subjectKey: {
        serviceId: value.serviceId,
        subjectKey: value.subjectKey,
      },
    },
    select: { id: true },
  });

  return subject
    ? { ok: true }
    : { ok: false, error: "Pasirinkta tema šiai paslaugai nerasta." };
}

async function validatePricingReferences(
  clientId: string,
  value: SuperAdminPricingBuilderForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = await prisma.service.findFirst({
    where: { id: value.serviceId, clientId },
    select: {
      id: true,
      decisionRequirements: {
        where: { active: true },
        select: { requirementKey: true },
      },
    },
  });
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  const knownKeys = new Set(
    service.decisionRequirements.map(
      (requirement) => requirement.requirementKey,
    ),
  );
  const referencedKeys = uniqueList([
    value.requirementKey,
    ...value.requires,
    ...value.modifiers.map((modifier) => modifier.requirementKey),
  ]);
  const missingKey = referencedKeys.find((key) => !knownKeys.has(key));
  if (missingKey) {
    return {
      ok: false,
      error: `Kainodara remiasi neegzistuojančiu aktyviu klausimu „${missingKey}“.`,
    };
  }

  return { ok: true };
}

async function findClientService(clientId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, clientId },
    select: { id: true },
  });
}

async function subjectHasRequirementReferences(
  clientId: string,
  serviceId: string,
  subjectKey: string,
): Promise<boolean> {
  const requirements = await prisma.decisionRequirement.findMany({
    where: { clientId, serviceId, active: true },
    select: { active: true, expectedFact: true },
  });
  return subjectDeleteBlockedByRequirements(subjectKey, requirements);
}

async function requirementHasPricingReferences(
  clientId: string,
  serviceId: string,
  requirementKey: string,
): Promise<boolean> {
  const pricingRules = await prisma.pricingRule.findMany({
    where: { clientId, serviceId, active: true },
    select: { active: true, rule: true },
  });
  return isRequirementKeyReferenced(requirementKey, pricingRules);
}

function parseModifierRows(
  formData: FormData,
): FormResult<SuperAdminPricingModifier[]> {
  const modifiers: SuperAdminPricingModifier[] = [];

  for (let index = 0; index < MAX_MODIFIER_ROWS; index += 1) {
    const requirementKey = textValue(
      formData,
      `modifierRequirementKey_${index}`,
    );
    const rawGte = textValue(formData, `modifierGte_${index}`);
    const rawDelta = textValue(formData, `modifierPricePerUnitDelta_${index}`);
    if (!requirementKey && !rawGte && !rawDelta) {
      continue;
    }

    if (!requirementKey || !rawGte || !rawDelta) {
      return {
        ok: false,
        error:
          "Užpildykite visus modifikatoriaus laukus arba palikite eilutę tuščią.",
      };
    }

    const gte = parseFiniteNumber(rawGte);
    const pricePerUnitDelta = parseFiniteNumber(rawDelta);
    if (gte === null || pricePerUnitDelta === null) {
      return {
        ok: false,
        error: "Modifikatoriaus riba ir kainos pokytis turi būti skaičiai.",
      };
    }

    modifiers.push({ requirementKey, gte, pricePerUnitDelta });
  }

  return { ok: true, value: modifiers };
}

function splitFormList(formData: FormData, key: string): string[] {
  const values = formData
    .getAll(key)
    .flatMap((value) => splitList(String(value)));
  return uniqueList(values);
}

function splitList(value: string): string[] {
  return uniqueList(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values));
}

function parseNumberField(
  formData: FormData,
  key: string,
): { value: number | null; error?: string } {
  const raw = textValue(formData, key);
  if (!raw) {
    return { value: null };
  }

  const value = parseFiniteNumber(raw);
  if (value === null) {
    return { value: null, error: `Laukas „${key}“ turi būti skaičius.` };
  }

  return { value };
}

function parseFiniteNumber(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableTextValue(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value ? value : null;
}

function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRequirementDimension(value: string): value is RequirementDimension {
  return REQUIREMENT_DIMENSIONS.some((dimension) => dimension === value);
}

function isSupportedPricingRuleType(
  value: string,
): value is SupportedPricingRuleType {
  return SUPPORTED_PRICING_RULE_TYPES.some((type) => type === value);
}

function isSupportedModifier(modifier: unknown): boolean {
  const record = asRecord(modifier);
  const condition = asRecord(record?.if);
  return (
    !!record &&
    !!condition &&
    typeof condition.requirementKey === "string" &&
    condition.requirementKey.trim() !== "" &&
    typeof condition.gte === "number" &&
    Number.isFinite(condition.gte) &&
    typeof record.pricePerUnitDelta === "number" &&
    Number.isFinite(record.pricePerUnitDelta) &&
    Object.keys(record).every(
      (key) => key === "if" || key === "pricePerUnitDelta",
    ) &&
    Object.keys(condition).every(
      (key) => key === "requirementKey" || key === "gte",
    )
  );
}

function parseSupportedModifiers(
  modifiers: unknown,
): SuperAdminPricingModifier[] {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  return modifiers.flatMap((modifier) => {
    if (!isSupportedModifier(modifier)) {
      return [];
    }
    const record = asRecord(modifier);
    const condition = asRecord(record?.if);
    return [
      {
        requirementKey: String(condition?.requirementKey),
        gte: Number(condition?.gte),
        pricePerUnitDelta: Number(record?.pricePerUnitDelta),
      },
    ];
  });
}

function requirementKeyInRule(
  requirementKey: string,
  ruleJson: unknown,
): boolean {
  const rule = asRecord(ruleJson);
  if (!rule) {
    return false;
  }

  if (rule.requirementKey === requirementKey) {
    return true;
  }
  if (Array.isArray(rule.requires) && rule.requires.includes(requirementKey)) {
    return true;
  }

  const modifiers = Array.isArray(rule.modifiers) ? rule.modifiers : [];
  return modifiers.some((modifier) => {
    const condition = asRecord(asRecord(modifier)?.if);
    return condition?.requirementKey === requirementKey;
  });
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}
