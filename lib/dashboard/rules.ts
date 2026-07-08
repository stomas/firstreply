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

export type DashboardRuleCreateContext = {
  serviceId: string;
  serviceName: string;
  requirements: Array<{ requirementKey: string; label: string }>;
  subjects: Array<{ subjectKey: string; labelLt: string }>;
};

export type DashboardPricingRuleCreate = {
  serviceId: string;
  name: string;
  ruleType: "per_unit" | "range_estimate";
  quantityKey: string;
  quantityUnit: string;
  pricePerUnit: number | null;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  requires: string[];
  autoSendAllowed: boolean;
  active: boolean;
  disclaimerText: string | null;
};

export type DashboardRequirementCreate = {
  serviceId: string;
  requirementKey: string;
  label: string;
  question: string;
  subjectKey: string | null;
  dimension: "length" | "height" | "width" | "area";
  required: boolean;
  affectsPrice: boolean;
  active: boolean;
  priority: number;
  validationMin: number | null;
  validationMax: number | null;
};

export type DashboardPricingRuleCreateFormResult =
  | { ok: true; value: DashboardPricingRuleCreate }
  | { ok: false; serviceId: string | null; error: string };

export type DashboardRequirementCreateFormResult =
  | { ok: true; value: DashboardRequirementCreate }
  | { ok: false; serviceId: string | null; error: string };

export const REQUIREMENT_DIMENSIONS: Array<{
  value: DashboardRequirementCreate["dimension"];
  label: string;
  unit: string;
}> = [
  { value: "length", label: "Ilgis (m)", unit: "m" },
  { value: "height", label: "Aukštis (m)", unit: "m" },
  { value: "width", label: "Plotis (m)", unit: "m" },
  { value: "area", label: "Plotas (m²)", unit: "m2" },
];

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

export async function getDashboardRuleCreateContext(
  clientId: string,
  serviceId: string,
): Promise<DashboardRuleCreateContext | null> {
  assertDatabaseConfigured();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clientId },
    select: {
      id: true,
      name: true,
      decisionRequirements: {
        where: { active: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: { requirementKey: true, label: true },
      },
      subjects: {
        orderBy: [{ labelLt: "asc" }],
        select: { subjectKey: true, labelLt: true },
      },
    },
  });
  if (!service) {
    return null;
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    requirements: service.decisionRequirements,
    subjects: service.subjects,
  };
}

export async function createDashboardPricingRule(
  clientId: string,
  create: DashboardPricingRuleCreate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const context = await getDashboardRuleCreateContext(
    clientId,
    create.serviceId,
  );
  if (!context) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  const knownKeys = new Set(
    context.requirements.map((requirement) => requirement.requirementKey),
  );
  if (!knownKeys.has(create.quantityKey)) {
    return { ok: false, error: "Pasirinkite, iš kurio klausimo imamas kiekis." };
  }
  const unknownRequire = create.requires.find((key) => !knownKeys.has(key));
  if (unknownRequire) {
    return { ok: false, error: `Nežinomas klausimas: ${unknownRequire}.` };
  }

  // rule JSON konstruojamas kode iš patikrintų reikšmių — UI niekada
  // nerašo laisvos struktūros.
  const ruleJson: Record<string, unknown> = {
    type: create.ruleType,
    requirementKey: create.quantityKey,
    unit: create.quantityUnit,
    currency: "EUR",
    requires: Array.from(new Set([create.quantityKey, ...create.requires])),
    ...(create.ruleType === "per_unit"
      ? { pricePerUnit: create.pricePerUnit }
      : {}),
  };

  await prisma.pricingRule.create({
    data: {
      clientId,
      serviceId: create.serviceId,
      name: create.name,
      priceMin: create.priceMin,
      priceMax: create.priceMax,
      unit: create.unit,
      autoSendAllowed: create.autoSendAllowed,
      active: create.active,
      disclaimerText: create.disclaimerText,
      rule: ruleJson as Prisma.InputJsonObject,
    },
  });

  return { ok: true };
}

export async function createDashboardRequirement(
  clientId: string,
  create: DashboardRequirementCreate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const context = await getDashboardRuleCreateContext(
    clientId,
    create.serviceId,
  );
  if (!context) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  const duplicate = await prisma.decisionRequirement.findFirst({
    where: {
      clientId,
      serviceId: create.serviceId,
      requirementKey: create.requirementKey,
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: `Klausimas raktu „${create.requirementKey}“ jau yra.`,
    };
  }

  if (
    create.subjectKey !== null &&
    !context.subjects.some((subject) => subject.subjectKey === create.subjectKey)
  ) {
    return { ok: false, error: "Pasirinkta tema nerasta." };
  }

  const dimension = REQUIREMENT_DIMENSIONS.find(
    (candidate) => candidate.value === create.dimension,
  );
  if (!dimension) {
    return { ok: false, error: "Pasirinkite matmenį." };
  }

  const expectedFact: Record<string, unknown> = {
    kind: "measurement",
    dimension: dimension.value,
    units: [dimension.unit],
    ...(create.subjectKey ? { subject: create.subjectKey } : {}),
  };

  const validation: Record<string, unknown> = {};
  if (create.validationMin !== null) {
    validation.min = create.validationMin;
  }
  if (create.validationMax !== null) {
    validation.max = create.validationMax;
  }

  await prisma.decisionRequirement.create({
    data: {
      clientId,
      serviceId: create.serviceId,
      requirementKey: create.requirementKey,
      label: create.label,
      requiredFor: "auto_send",
      questionTextIfMissing: create.question,
      blocksAutoSend: create.required,
      required: create.required,
      affectsPrice: create.affectsPrice,
      active: create.active,
      priority: create.priority,
      expectedFact: expectedFact as Prisma.InputJsonObject,
      validation:
        Object.keys(validation).length > 0
          ? (validation as Prisma.InputJsonObject)
          : Prisma.JsonNull,
    },
  });

  return { ok: true };
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

export function parseDashboardPricingRuleCreateForm(
  formData: FormData,
): DashboardPricingRuleCreateFormResult {
  const serviceId = textValue(formData, "serviceId");
  if (!serviceId) {
    return { ok: false, serviceId: null, error: "Paslauga nerasta." };
  }

  const name = textValue(formData, "name");
  if (!name) {
    return { ok: false, serviceId, error: "Įveskite taisyklės pavadinimą." };
  }

  const ruleType = textValue(formData, "ruleType");
  if (ruleType !== "per_unit" && ruleType !== "range_estimate") {
    return { ok: false, serviceId, error: "Pasirinkite skaičiavimo tipą." };
  }

  const quantityKey = textValue(formData, "quantityKey");
  if (!quantityKey) {
    return {
      ok: false,
      serviceId,
      error: "Pasirinkite, iš kurio klausimo imamas kiekis.",
    };
  }

  const priceMin = parseNumberField(formData, "priceMin");
  const priceMax = parseNumberField(formData, "priceMax");
  const pricePerUnit = parseNumberField(formData, "pricePerUnit");
  const numberError = priceMin.error ?? priceMax.error ?? pricePerUnit.error;
  if (numberError) {
    return { ok: false, serviceId, error: numberError };
  }

  if (ruleType === "per_unit") {
    if (pricePerUnit.value === null) {
      return { ok: false, serviceId, error: "Įveskite vieneto kainą." };
    }
    if (pricePerUnit.value <= 0) {
      return {
        ok: false,
        serviceId,
        error: "Vieneto kaina turi būti didesnė už nulį.",
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
      serviceId,
      error: "Kaina „nuo“ negali būti didesnė už kainą „iki“.",
    };
  }

  return {
    ok: true,
    value: {
      serviceId,
      name,
      ruleType,
      quantityKey,
      quantityUnit: textValue(formData, "quantityUnit") || "m",
      pricePerUnit: ruleType === "per_unit" ? pricePerUnit.value : null,
      priceMin: priceMin.value,
      priceMax: priceMax.value,
      unit: nullableTextValue(formData, "unit"),
      requires: formData
        .getAll("requires")
        .map((value) => String(value).trim())
        .filter(Boolean),
      autoSendAllowed: formData.get("autoSendAllowed") === "on",
      active: formData.get("active") === "on",
      disclaimerText: nullableTextValue(formData, "disclaimerText"),
    },
  };
}

export function parseDashboardRequirementCreateForm(
  formData: FormData,
): DashboardRequirementCreateFormResult {
  const serviceId = textValue(formData, "serviceId");
  if (!serviceId) {
    return { ok: false, serviceId: null, error: "Paslauga nerasta." };
  }

  const label = textValue(formData, "label");
  if (!label) {
    return { ok: false, serviceId, error: "Įveskite klausimo pavadinimą." };
  }

  const question = textValue(formData, "question");
  if (!question) {
    return {
      ok: false,
      serviceId,
      error: "Įveskite klausimo tekstą klientui.",
    };
  }

  const requirementKey = slugifyRequirementKey(
    textValue(formData, "requirementKey") || label,
  );
  if (!requirementKey) {
    return {
      ok: false,
      serviceId,
      error: "Rakto nepavyko sudaryti — įveskite raktą lotyniškomis raidėmis.",
    };
  }

  const dimension = textValue(formData, "dimension");
  if (
    !REQUIREMENT_DIMENSIONS.some((candidate) => candidate.value === dimension)
  ) {
    return { ok: false, serviceId, error: "Pasirinkite matmenį." };
  }

  const priority = parseNumberField(formData, "priority");
  const validationMin = parseNumberField(formData, "validationMin");
  const validationMax = parseNumberField(formData, "validationMax");
  const numberError =
    priority.error ?? validationMin.error ?? validationMax.error;
  if (numberError) {
    return { ok: false, serviceId, error: numberError };
  }

  if (
    validationMin.value !== null &&
    validationMax.value !== null &&
    validationMin.value > validationMax.value
  ) {
    return {
      ok: false,
      serviceId,
      error: "Riba „nuo“ negali būti didesnė už ribą „iki“.",
    };
  }

  return {
    ok: true,
    value: {
      serviceId,
      requirementKey,
      label,
      question,
      subjectKey: nullableTextValue(formData, "subjectKey"),
      dimension: dimension as DashboardRequirementCreate["dimension"],
      required: formData.get("required") === "on",
      affectsPrice: formData.get("affectsPrice") === "on",
      active: formData.get("active") === "on",
      priority: priority.value !== null ? Math.round(priority.value) : 100,
      validationMin: validationMin.value,
      validationMax: validationMax.value,
    },
  };
}

export function slugifyRequirementKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
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
