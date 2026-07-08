import { Prisma } from "@prisma/client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export type DashboardPricingRuleRow = {
  id: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  active: boolean;
  autoSendAllowed: boolean;
  ruleType: string | null;
  pricePerUnit: number | null;
  requirementKey: string | null;
  requires: string[];
  modifierSummaries: string[];
  disclaimerText: string | null;
};

export type DashboardRequirementRow = {
  id: string;
  requirementKey: string;
  label: string;
  question: string;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  validationMin: number | null;
  validationMax: number | null;
  expectedFactSummary: string | null;
};

export type DashboardRulesServiceGroup = {
  serviceId: string;
  serviceName: string;
  serviceActive: boolean;
  pricingRules: DashboardPricingRuleRow[];
  requirements: DashboardRequirementRow[];
};

export type DashboardRulesSummary = {
  pricingRules: number;
  requirements: number;
  autoSendEnabled: number;
  inactive: number;
};

export type DashboardPricingRuleUpdate = {
  pricingRuleId: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  pricePerUnit: number | null;
  autoSendAllowed: boolean;
  active: boolean;
  disclaimerText: string | null;
};

export type DashboardRequirementUpdate = {
  requirementId: string;
  label: string;
  question: string;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  validationMin: number | null;
  validationMax: number | null;
};

export type DashboardPricingRuleFormResult =
  | { ok: true; value: DashboardPricingRuleUpdate }
  | { ok: false; pricingRuleId: string | null; error: string };

export type DashboardRequirementFormResult =
  | { ok: true; value: DashboardRequirementUpdate }
  | { ok: false; requirementId: string | null; error: string };

export async function getDashboardRules(
  clientId: string,
): Promise<DashboardRulesServiceGroup[]> {
  assertDatabaseConfigured();

  const services = await prisma.service.findMany({
    where: { clientId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      pricingRules: {
        orderBy: [{ active: "desc" }, { name: "asc" }],
      },
      decisionRequirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return services.map((service) => ({
    serviceId: service.id,
    serviceName: service.name,
    serviceActive: service.active,
    pricingRules: service.pricingRules.map(toPricingRuleRow),
    requirements: service.decisionRequirements.map(toRequirementRow),
  }));
}

export async function getDashboardPricingRuleEdit(
  clientId: string,
  pricingRuleId: string,
): Promise<(DashboardPricingRuleRow & { serviceName: string }) | null> {
  assertDatabaseConfigured();

  const rule = await prisma.pricingRule.findFirst({
    where: { id: pricingRuleId, clientId },
    include: { service: { select: { name: true } } },
  });
  if (!rule) {
    return null;
  }

  return { ...toPricingRuleRow(rule), serviceName: rule.service.name };
}

export async function getDashboardRequirementEdit(
  clientId: string,
  requirementId: string,
): Promise<(DashboardRequirementRow & { serviceName: string }) | null> {
  assertDatabaseConfigured();

  const requirement = await prisma.decisionRequirement.findFirst({
    where: { id: requirementId, clientId },
    include: { service: { select: { name: true } } },
  });
  if (!requirement) {
    return null;
  }

  return {
    ...toRequirementRow(requirement),
    serviceName: requirement.service.name,
  };
}

export async function updateDashboardPricingRule(
  clientId: string,
  update: DashboardPricingRuleUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const existing = await prisma.pricingRule.findFirst({
    where: { id: update.pricingRuleId, clientId },
    select: { id: true, rule: true },
  });
  if (!existing) {
    return { ok: false, error: "Kainodaros taisyklė nerasta." };
  }

  // pricePerUnit gyvena rule JSON viduje — atnaujinam TIK šį lauką,
  // struktūra (requirementKey, requires, modifiers) lieka nepaliesta.
  const existingRule = asRecord(existing.rule);
  const ruleJson =
    update.pricePerUnit !== null &&
    existingRule &&
    existingRule.type === "per_unit"
      ? { ...existingRule, pricePerUnit: update.pricePerUnit }
      : existingRule;

  await prisma.pricingRule.update({
    where: { id: update.pricingRuleId },
    data: {
      name: update.name,
      priceMin: update.priceMin,
      priceMax: update.priceMax,
      unit: update.unit,
      autoSendAllowed: update.autoSendAllowed,
      active: update.active,
      disclaimerText: update.disclaimerText,
      ...(ruleJson
        ? { rule: ruleJson as unknown as Prisma.InputJsonObject }
        : {}),
    },
  });

  return { ok: true };
}

export async function updateDashboardRequirement(
  clientId: string,
  update: DashboardRequirementUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const existing = await prisma.decisionRequirement.findFirst({
    where: { id: update.requirementId, clientId },
    select: { id: true, validation: true },
  });
  if (!existing) {
    return { ok: false, error: "Klausimas nerastas." };
  }

  // min/max merge'inami į esamą validation JSON, kiti raktai išsaugomi.
  const existingValidation = asRecord(existing.validation) ?? {};
  const validation: Record<string, unknown> = { ...existingValidation };
  if (update.validationMin !== null) {
    validation.min = update.validationMin;
  } else {
    delete validation.min;
  }
  if (update.validationMax !== null) {
    validation.max = update.validationMax;
  } else {
    delete validation.max;
  }

  await prisma.decisionRequirement.update({
    where: { id: update.requirementId },
    data: {
      label: update.label,
      questionTextIfMissing: update.question,
      required: update.required,
      affectsPrice: update.affectsPrice,
      active: update.active,
      priority: update.priority,
      validation:
        Object.keys(validation).length > 0
          ? (validation as Prisma.InputJsonObject)
          : Prisma.JsonNull,
    },
  });

  return { ok: true };
}

export function parseDashboardPricingRuleForm(
  formData: FormData,
): DashboardPricingRuleFormResult {
  const pricingRuleId = textValue(formData, "pricingRuleId");
  if (!pricingRuleId) {
    return { ok: false, pricingRuleId: null, error: "Taisyklė nerasta." };
  }

  const name = textValue(formData, "name");
  if (!name) {
    return {
      ok: false,
      pricingRuleId,
      error: "Įveskite taisyklės pavadinimą.",
    };
  }

  const priceMin = parseNumberField(formData, "priceMin");
  const priceMax = parseNumberField(formData, "priceMax");
  const pricePerUnit = parseNumberField(formData, "pricePerUnit");
  const numberError = priceMin.error ?? priceMax.error ?? pricePerUnit.error;
  if (numberError) {
    return { ok: false, pricingRuleId, error: numberError };
  }

  if (
    priceMin.value !== null &&
    priceMax.value !== null &&
    priceMin.value > priceMax.value
  ) {
    return {
      ok: false,
      pricingRuleId,
      error: "Kaina „nuo“ negali būti didesnė už kainą „iki“.",
    };
  }
  if (pricePerUnit.value !== null && pricePerUnit.value <= 0) {
    return {
      ok: false,
      pricingRuleId,
      error: "Vieneto kaina turi būti didesnė už nulį.",
    };
  }

  return {
    ok: true,
    value: {
      pricingRuleId,
      name,
      priceMin: priceMin.value,
      priceMax: priceMax.value,
      unit: nullableTextValue(formData, "unit"),
      pricePerUnit: pricePerUnit.value,
      autoSendAllowed: formData.get("autoSendAllowed") === "on",
      active: formData.get("active") === "on",
      disclaimerText: nullableTextValue(formData, "disclaimerText"),
    },
  };
}

export function parseDashboardRequirementForm(
  formData: FormData,
): DashboardRequirementFormResult {
  const requirementId = textValue(formData, "requirementId");
  if (!requirementId) {
    return { ok: false, requirementId: null, error: "Klausimas nerastas." };
  }

  const label = textValue(formData, "label");
  if (!label) {
    return {
      ok: false,
      requirementId,
      error: "Įveskite klausimo pavadinimą.",
    };
  }

  const question = textValue(formData, "question");
  if (!question) {
    return {
      ok: false,
      requirementId,
      error: "Įveskite klausimo tekstą klientui.",
    };
  }

  const priority = parseNumberField(formData, "priority");
  const validationMin = parseNumberField(formData, "validationMin");
  const validationMax = parseNumberField(formData, "validationMax");
  const numberError =
    priority.error ?? validationMin.error ?? validationMax.error;
  if (numberError) {
    return { ok: false, requirementId, error: numberError };
  }

  if (
    validationMin.value !== null &&
    validationMax.value !== null &&
    validationMin.value > validationMax.value
  ) {
    return {
      ok: false,
      requirementId,
      error: "Riba „nuo“ negali būti didesnė už ribą „iki“.",
    };
  }

  return {
    ok: true,
    value: {
      requirementId,
      label,
      question,
      required: formData.get("required") === "on",
      affectsPrice: formData.get("affectsPrice") === "on",
      active: formData.get("active") === "on",
      priority:
        priority.value !== null ? Math.round(priority.value) : 100,
      validationMin: validationMin.value,
      validationMax: validationMax.value,
    },
  };
}

export function summarizeDashboardRules(
  groups: DashboardRulesServiceGroup[],
): DashboardRulesSummary {
  const pricingRules = groups.flatMap((group) => group.pricingRules);
  const requirements = groups.flatMap((group) => group.requirements);

  return {
    pricingRules: pricingRules.filter((rule) => rule.active).length,
    requirements: requirements.filter((requirement) => requirement.active)
      .length,
    autoSendEnabled: pricingRules.filter(
      (rule) => rule.active && rule.autoSendAllowed,
    ).length,
    inactive:
      pricingRules.filter((rule) => !rule.active).length +
      requirements.filter((requirement) => !requirement.active).length,
  };
}

type PricingRuleSource = {
  id: string;
  name: string;
  priceMin: Prisma.Decimal | number | null;
  priceMax: Prisma.Decimal | number | null;
  unit: string | null;
  active: boolean;
  autoSendAllowed: boolean;
  rule: Prisma.JsonValue;
  disclaimerText: string | null;
};

function toPricingRuleRow(source: PricingRuleSource): DashboardPricingRuleRow {
  const rule = asRecord(source.rule);
  const modifiers = Array.isArray(rule?.modifiers) ? rule.modifiers : [];

  return {
    id: source.id,
    name: source.name,
    priceMin: decimalToNumber(source.priceMin),
    priceMax: decimalToNumber(source.priceMax),
    unit: source.unit,
    active: source.active,
    autoSendAllowed: source.autoSendAllowed,
    ruleType: typeof rule?.type === "string" ? rule.type : null,
    pricePerUnit:
      typeof rule?.pricePerUnit === "number" ? rule.pricePerUnit : null,
    requirementKey:
      typeof rule?.requirementKey === "string" ? rule.requirementKey : null,
    requires: Array.isArray(rule?.requires)
      ? rule.requires.filter((key): key is string => typeof key === "string")
      : [],
    modifierSummaries: modifiers
      .map((modifier) => modifierSummary(modifier, source.unit))
      .filter((summary): summary is string => summary !== null),
    disclaimerText: source.disclaimerText,
  };
}

type RequirementSource = {
  id: string;
  requirementKey: string;
  label: string;
  questionTextIfMissing: string;
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  validation: Prisma.JsonValue;
  expectedFact: Prisma.JsonValue;
};

function toRequirementRow(source: RequirementSource): DashboardRequirementRow {
  const validation = asRecord(source.validation);
  const expectedFact = asRecord(source.expectedFact);

  return {
    id: source.id,
    requirementKey: source.requirementKey,
    label: source.label,
    question: source.questionTextIfMissing,
    required: source.required,
    affectsPrice: source.affectsPrice,
    active: source.active,
    priority: source.priority,
    validationMin:
      typeof validation?.min === "number" ? validation.min : null,
    validationMax:
      typeof validation?.max === "number" ? validation.max : null,
    expectedFactSummary: expectedFactSummary(expectedFact),
  };
}

function modifierSummary(modifier: unknown, unit: string | null): string | null {
  const record = asRecord(modifier);
  const condition = asRecord(record?.if);
  const requirementKey =
    typeof condition?.requirementKey === "string"
      ? condition.requirementKey
      : null;
  const gte = typeof condition?.gte === "number" ? condition.gte : null;
  const delta =
    typeof record?.pricePerUnitDelta === "number"
      ? record.pricePerUnitDelta
      : null;

  if (!requirementKey || gte === null || delta === null) {
    return null;
  }

  const sign = delta > 0 ? "+" : "";
  return `${requirementKey} ≥ ${gte} → ${sign}${delta} ${unit ?? ""}`.trim();
}

function expectedFactSummary(
  expectedFact: Record<string, unknown> | null,
): string | null {
  if (!expectedFact) {
    return null;
  }

  const parts = [
    expectedFact.kind,
    expectedFact.subject,
    expectedFact.dimension,
    Array.isArray(expectedFact.units) ? expectedFact.units.join("/") : null,
  ].filter((part): part is string => typeof part === "string" && part !== "");

  return parts.length > 0 ? parts.join(" · ") : null;
}

function parseNumberField(
  formData: FormData,
  key: string,
): { value: number | null; error?: string } {
  const raw = textValue(formData, key);
  if (!raw) {
    return { value: null };
  }

  // Priimam ir lietuvišką kablelį ("1,5").
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) {
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

function decimalToNumber(
  value: Prisma.Decimal | number | null,
): number | null {
  return value === null ? null : Number(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
