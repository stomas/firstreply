import { assertDatabaseConfigured, prisma } from "@/lib/db";

export const AVAILABILITY_STATUSES = [
  {
    value: "available",
    label: "Priimame užsakymus",
    description: "Klientui nurodomas terminas ir galima siųsti atsakymą.",
  },
  {
    value: "limited",
    label: "Ribotos galimybės",
    description: "Terminas tikslinamas — atsakymai eina per peržiūrą.",
  },
  {
    value: "unavailable",
    label: "Nepriimame",
    description: "Šiuo metu užsakymų šiame regione nepriimate.",
  },
] as const;

export type AvailabilityStatus =
  (typeof AVAILABILITY_STATUSES)[number]["value"];

export type DashboardAvailabilityRow = {
  id: string;
  location: string | null;
  status: string;
  statusLabel: string;
  earliestStartText: string | null;
  noteForCustomer: string | null;
  validUntil: string | null;
  expired: boolean;
  autoSendAllowed: boolean;
};

export type DashboardAvailabilityServiceGroup = {
  serviceId: string;
  serviceName: string;
  serviceActive: boolean;
  rules: DashboardAvailabilityRow[];
};

export type DashboardAvailabilitySummary = {
  total: number;
  valid: number;
  autoSendEnabled: number;
  expired: number;
};

export type DashboardAvailabilityValues = {
  location: string | null;
  status: AvailabilityStatus;
  earliestStartText: string | null;
  noteForCustomer: string | null;
  validUntil: Date | null;
  autoSendAllowed: boolean;
};

export type DashboardAvailabilityCreate = DashboardAvailabilityValues & {
  serviceId: string;
};

export type DashboardAvailabilityUpdate = DashboardAvailabilityValues & {
  ruleId: string;
};

export type DashboardAvailabilityCreateFormResult =
  | { ok: true; value: DashboardAvailabilityCreate }
  | { ok: false; serviceId: string | null; error: string };

export type DashboardAvailabilityUpdateFormResult =
  | { ok: true; value: DashboardAvailabilityUpdate }
  | { ok: false; ruleId: string | null; error: string };

export async function getDashboardAvailability(
  clientId: string,
  now: Date = new Date(),
): Promise<DashboardAvailabilityServiceGroup[]> {
  assertDatabaseConfigured();

  const services = await prisma.service.findMany({
    where: { clientId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      availabilityRules: {
        orderBy: [{ location: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return services.map((service) => ({
    serviceId: service.id,
    serviceName: service.name,
    serviceActive: service.active,
    rules: service.availabilityRules.map((rule) =>
      toAvailabilityRow(rule, now),
    ),
  }));
}

export async function getDashboardAvailabilityEdit(
  clientId: string,
  ruleId: string,
  now: Date = new Date(),
): Promise<(DashboardAvailabilityRow & { serviceName: string }) | null> {
  assertDatabaseConfigured();

  const rule = await prisma.availabilityRule.findFirst({
    where: { id: ruleId, clientId },
    include: { service: { select: { name: true } } },
  });
  if (!rule) {
    return null;
  }

  return { ...toAvailabilityRow(rule, now), serviceName: rule.service.name };
}

export async function createDashboardAvailabilityRule(
  clientId: string,
  create: DashboardAvailabilityCreate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const service = await prisma.service.findFirst({
    where: { id: create.serviceId, clientId },
    select: { id: true },
  });
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  await prisma.availabilityRule.create({
    data: {
      clientId,
      serviceId: create.serviceId,
      location: create.location ?? "",
      status: create.status,
      earliestStartText: create.earliestStartText,
      noteForCustomer: create.noteForCustomer,
      validUntil: create.validUntil,
      autoSendAllowed: create.autoSendAllowed,
    },
  });

  return { ok: true };
}

export async function updateDashboardAvailabilityRule(
  clientId: string,
  update: DashboardAvailabilityUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const existing = await prisma.availabilityRule.findFirst({
    where: { id: update.ruleId, clientId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Užimtumo įrašas nerastas." };
  }

  await prisma.availabilityRule.update({
    where: { id: update.ruleId },
    data: {
      location: update.location ?? "",
      status: update.status,
      earliestStartText: update.earliestStartText,
      noteForCustomer: update.noteForCustomer,
      validUntil: update.validUntil,
      autoSendAllowed: update.autoSendAllowed,
    },
  });

  return { ok: true };
}

export function parseDashboardAvailabilityCreateForm(
  formData: FormData,
): DashboardAvailabilityCreateFormResult {
  const serviceId = textValue(formData, "serviceId");
  if (!serviceId) {
    return { ok: false, serviceId: null, error: "Paslauga nerasta." };
  }

  const values = parseAvailabilityValues(formData);
  if (!values.ok) {
    return { ok: false, serviceId, error: values.error };
  }

  return { ok: true, value: { serviceId, ...values.value } };
}

export function parseDashboardAvailabilityUpdateForm(
  formData: FormData,
): DashboardAvailabilityUpdateFormResult {
  const ruleId = textValue(formData, "ruleId");
  if (!ruleId) {
    return { ok: false, ruleId: null, error: "Užimtumo įrašas nerastas." };
  }

  const values = parseAvailabilityValues(formData);
  if (!values.ok) {
    return { ok: false, ruleId, error: values.error };
  }

  return { ok: true, value: { ruleId, ...values.value } };
}

export function summarizeDashboardAvailability(
  groups: DashboardAvailabilityServiceGroup[],
): DashboardAvailabilitySummary {
  const rules = groups.flatMap((group) => group.rules);

  return {
    total: rules.length,
    valid: rules.filter((rule) => !rule.expired).length,
    autoSendEnabled: rules.filter(
      (rule) => !rule.expired && rule.autoSendAllowed,
    ).length,
    expired: rules.filter((rule) => rule.expired).length,
  };
}

export function availabilityStatusLabel(status: string): string {
  return (
    AVAILABILITY_STATUSES.find((candidate) => candidate.value === status)
      ?.label ?? status
  );
}

function parseAvailabilityValues(
  formData: FormData,
):
  | { ok: true; value: DashboardAvailabilityValues }
  | { ok: false; error: string } {
  const status = textValue(formData, "status");
  if (!AVAILABILITY_STATUSES.some((candidate) => candidate.value === status)) {
    return { ok: false, error: "Pasirinkite užimtumo būseną." };
  }

  const validUntilRaw = textValue(formData, "validUntil");
  let validUntil: Date | null = null;
  if (validUntilRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(validUntilRaw)) {
      return {
        ok: false,
        error: "Galiojimo data turi būti formato MMMM-mm-dd.",
      };
    }
    const parsed = new Date(`${validUntilRaw}T23:59:59.999Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Galiojimo data netinkama." };
    }
    validUntil = parsed;
  }

  return {
    ok: true,
    value: {
      location: nullableTextValue(formData, "location"),
      status: status as AvailabilityStatus,
      earliestStartText: nullableTextValue(formData, "earliestStartText"),
      noteForCustomer: nullableTextValue(formData, "noteForCustomer"),
      validUntil,
      autoSendAllowed: formData.get("autoSendAllowed") === "on",
    },
  };
}

type AvailabilityRuleSource = {
  id: string;
  location: string | null;
  status: string;
  earliestStartText: string | null;
  noteForCustomer: string | null;
  validUntil: Date | null;
  autoSendAllowed: boolean;
};

function toAvailabilityRow(
  source: AvailabilityRuleSource,
  now: Date,
): DashboardAvailabilityRow {
  const location = source.location?.trim() ? source.location.trim() : null;
  const validUntil = source.validUntil
    ? source.validUntil.toISOString().slice(0, 10)
    : null;

  return {
    id: source.id,
    location,
    status: source.status,
    statusLabel: availabilityStatusLabel(source.status),
    earliestStartText: source.earliestStartText,
    noteForCustomer: source.noteForCustomer,
    validUntil,
    expired: source.validUntil !== null && source.validUntil < now,
    autoSendAllowed: source.autoSendAllowed,
  };
}

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableTextValue(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value ? value : null;
}
