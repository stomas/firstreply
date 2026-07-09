import type { Prisma } from "@prisma/client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export type DashboardServiceRecord = {
  id: string;
  name: string;
  label: string | null;
  active: boolean;
  keywords: string[];
  offeringDescription: string | null;
  subjects: Array<{
    subjectKey: string;
    labelLt: string;
  }>;
  pricingRules: Array<{
    active: boolean;
  }>;
  decisionRequirements: Array<{
    active: boolean;
    required: boolean;
  }>;
  availabilityRules: Array<{
    autoSendAllowed: boolean;
  }>;
};

export type DashboardServiceSubjectEdit = {
  subjectKey: string;
  labelLt: string;
  descriptionLt: string;
  synonyms: string[];
};

export type DashboardServiceEdit = {
  id: string;
  name: string;
  label: string | null;
  active: boolean;
  keywords: string[];
  offeringDescription: string | null;
  offeringFollowup: string | null;
  subjects: DashboardServiceSubjectEdit[];
  card: DashboardServiceCard;
};

export type DashboardServiceUpdate = {
  serviceId: string;
  name: string;
  label: string | null;
  active: boolean;
  keywords: string[];
  offeringDescription: string | null;
  offeringFollowup: string | null;
  subjects: DashboardServiceSubjectEdit[];
};

export type DashboardServiceFormResult =
  | { ok: true; value: DashboardServiceUpdate }
  | { ok: false; serviceId: string | null; error: string };

export type DashboardServiceCard = {
  id: string;
  name: string;
  label: string | null;
  active: boolean;
  status: "ready" | "needs_setup" | "inactive";
  statusLabel: string;
  keywordsPreview: string[];
  keywordCount: number;
  subjectLabels: string[];
  pricingRuleCount: number;
  requiredQuestionCount: number;
  optionalQuestionCount: number;
  availabilityRuleCount: number;
  autoSendAvailabilityCount: number;
  hasOfferingDescription: boolean;
  missingSetup: string[];
};

export type DashboardServicesSummary = {
  total: number;
  active: number;
  ready: number;
  needsSetup: number;
};

export async function getDashboardServices(
  clientId: string,
): Promise<DashboardServiceCard[]> {
  assertDatabaseConfigured();

  const services = await prisma.service.findMany({
    where: { clientId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      subjects: {
        orderBy: [{ labelLt: "asc" }, { subjectKey: "asc" }],
        select: {
          subjectKey: true,
          labelLt: true,
        },
      },
      pricingRules: {
        where: { active: true },
        select: {
          active: true,
        },
      },
      decisionRequirements: {
        where: { active: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: {
          active: true,
          required: true,
        },
      },
      availabilityRules: {
        select: {
          autoSendAllowed: true,
        },
      },
    },
  });

  return toDashboardServiceCards(
    services.map((service) => ({
      id: service.id,
      name: service.name,
      label: service.label,
      active: service.active,
      keywords: Array.isArray(service.keywords)
        ? service.keywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : [],
      offeringDescription: service.offeringDescription,
      subjects: service.subjects,
      pricingRules: service.pricingRules,
      decisionRequirements: service.decisionRequirements,
      availabilityRules: service.availabilityRules,
    })),
  );
}

export async function getDashboardServiceEdit(
  clientId: string,
  serviceId: string,
): Promise<DashboardServiceEdit | null> {
  assertDatabaseConfigured();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clientId },
    include: {
      subjects: {
        orderBy: [{ labelLt: "asc" }, { subjectKey: "asc" }],
        select: {
          subjectKey: true,
          labelLt: true,
          synonyms: true,
        },
      },
      pricingRules: {
        where: { active: true },
        select: {
          active: true,
        },
      },
      decisionRequirements: {
        where: { active: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        select: {
          active: true,
          required: true,
        },
      },
      availabilityRules: {
        select: {
          autoSendAllowed: true,
        },
      },
    },
  });

  if (!service) {
    return null;
  }

  const record: DashboardServiceRecord = {
    id: service.id,
    name: service.name,
    label: service.label,
    active: service.active,
    keywords: stringArrayFromJson(service.keywords),
    offeringDescription: service.offeringDescription,
    subjects: service.subjects,
    pricingRules: service.pricingRules,
    decisionRequirements: service.decisionRequirements,
    availabilityRules: service.availabilityRules,
  };
  const [card] = toDashboardServiceCards([record]);

  return {
    id: service.id,
    name: service.name,
    label: service.label,
    active: service.active,
    keywords: record.keywords,
    offeringDescription: service.offeringDescription,
    offeringFollowup: service.offeringFollowup,
    subjects: service.subjects.map((subject) => ({
      subjectKey: subject.subjectKey,
      labelLt: subject.labelLt,
      descriptionLt: subject.labelLt,
      synonyms: stringArrayFromJson(subject.synonyms),
    })),
    card,
  };
}

export async function updateDashboardService(
  clientId: string,
  update: DashboardServiceUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertDatabaseConfigured();

  const existing = await prisma.service.findFirst({
    where: { id: update.serviceId, clientId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: update.serviceId },
      data: {
        name: update.name,
        label: update.label,
        active: update.active,
        keywords: update.keywords as unknown as Prisma.InputJsonArray,
        offeringDescription: update.offeringDescription,
        offeringFollowup: update.offeringFollowup,
      },
    });

    for (const subject of update.subjects) {
      await tx.serviceSubject.upsert({
        where: {
          serviceId_subjectKey: {
            serviceId: update.serviceId,
            subjectKey: subject.subjectKey,
          },
        },
        create: {
          serviceId: update.serviceId,
          subjectKey: subject.subjectKey,
          labelLt: subject.labelLt,
          descriptionLt: subject.labelLt,
          synonyms: subject.synonyms as unknown as Prisma.InputJsonArray,
        },
        update: {
          labelLt: subject.labelLt,
          descriptionLt: subject.labelLt,
          synonyms: subject.synonyms as unknown as Prisma.InputJsonArray,
        },
      });
    }
  });

  return { ok: true };
}

export function parseDashboardServiceForm(
  formData: FormData,
): DashboardServiceFormResult {
  const serviceId = textValue(formData, "serviceId");
  const name = textValue(formData, "name");
  if (!serviceId) {
    return { ok: false, serviceId: null, error: "Paslauga nerasta." };
  }
  if (!name) {
    return {
      ok: false,
      serviceId,
      error: "Įveskite paslaugos pavadinimą.",
    };
  }

  const parsedSubjects = parseSubjectRows(formData);
  if (!parsedSubjects.ok) {
    return { ok: false, serviceId, error: parsedSubjects.error };
  }

  return {
    ok: true,
    value: {
      serviceId,
      name,
      label: nullableTextValue(formData, "label"),
      active: formData.get("active") === "on",
      keywords: splitTokens(textValue(formData, "keywords")),
      offeringDescription: nullableTextValue(formData, "offeringDescription"),
      offeringFollowup: nullableTextValue(formData, "offeringFollowup"),
      subjects: parsedSubjects.subjects,
    },
  };
}

export function toDashboardServiceCards(
  services: DashboardServiceRecord[],
): DashboardServiceCard[] {
  return services.map((service) => {
    const pricingRuleCount = service.pricingRules.filter(
      (rule) => rule.active,
    ).length;
    const activeRequirements = service.decisionRequirements.filter(
      (requirement) => requirement.active,
    );
    const requiredQuestionCount = activeRequirements.filter(
      (requirement) => requirement.required,
    ).length;
    const optionalQuestionCount =
      activeRequirements.length - requiredQuestionCount;
    const subjectLabels = service.subjects.map((subject) => subject.labelLt);
    const hasOfferingDescription = Boolean(service.offeringDescription?.trim());
    const missingSetup = missingSetupForService({
      keywordCount: service.keywords.length,
      subjectCount: subjectLabels.length,
      pricingRuleCount,
      questionCount: activeRequirements.length,
      hasOfferingDescription,
    });
    const status = !service.active
      ? "inactive"
      : missingSetup.length > 0
        ? "needs_setup"
        : "ready";

    return {
      id: service.id,
      name: service.name,
      label: service.label,
      active: service.active,
      status,
      statusLabel:
        status === "ready"
          ? "Paruošta"
          : status === "inactive"
            ? "Neaktyvi"
            : "Reikia papildyti",
      keywordsPreview: service.keywords.slice(0, 4),
      keywordCount: service.keywords.length,
      subjectLabels,
      pricingRuleCount,
      requiredQuestionCount,
      optionalQuestionCount,
      availabilityRuleCount: service.availabilityRules.length,
      autoSendAvailabilityCount: service.availabilityRules.filter(
        (rule) => rule.autoSendAllowed,
      ).length,
      hasOfferingDescription,
      missingSetup,
    };
  });
}

function parseSubjectRows(
  formData: FormData,
):
  | { ok: true; subjects: DashboardServiceSubjectEdit[] }
  | { ok: false; error: string } {
  const keys = formData.getAll("subjectKey").map((value) => String(value));
  const labels = formData.getAll("subjectLabel").map((value) => String(value));
  const synonyms = formData
    .getAll("subjectSynonyms")
    .map((value) => String(value));
  const rowCount = Math.max(keys.length, labels.length, synonyms.length);
  const subjects: DashboardServiceSubjectEdit[] = [];
  const seenKeys = new Set<string>();

  for (let index = 0; index < rowCount; index += 1) {
    const labelLt = labels[index]?.trim() ?? "";
    const synonymList = splitTokens(synonyms[index] ?? "");
    const existingKey = slugifySubjectKey(keys[index] ?? "");

    if (!labelLt && synonymList.length === 0 && !existingKey) {
      continue;
    }
    if (!labelLt) {
      return {
        ok: false,
        error: "Įveskite temos pavadinimą arba palikite eilutę tuščią.",
      };
    }

    const subjectKey = existingKey || slugifySubjectKey(labelLt);
    if (!subjectKey) {
      return { ok: false, error: "Temos pavadinimas netinka." };
    }
    if (seenKeys.has(subjectKey)) {
      continue;
    }

    seenKeys.add(subjectKey);
    subjects.push({
      subjectKey,
      labelLt,
      descriptionLt: labelLt,
      synonyms: synonymList.length > 0 ? synonymList : [labelLt],
    });
  }

  return { ok: true, subjects };
}

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableTextValue(formData: FormData, key: string): string | null {
  const value = textValue(formData, key);
  return value ? value : null;
}

function splitTokens(value: string): string[] {
  const tokens = value
    .split(/[\n,]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  return Array.from(new Set(tokens));
}

function slugifySubjectKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function stringArrayFromJson(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function summarizeDashboardServices(
  services: DashboardServiceRecord[],
): DashboardServicesSummary {
  const cards = toDashboardServiceCards(services);

  return {
    total: cards.length,
    active: cards.filter((service) => service.active).length,
    ready: cards.filter((service) => service.status === "ready").length,
    needsSetup: cards.filter((service) => service.status === "needs_setup")
      .length,
  };
}

export function summarizeDashboardServiceCards(
  cards: DashboardServiceCard[],
): DashboardServicesSummary {
  return {
    total: cards.length,
    active: cards.filter((service) => service.active).length,
    ready: cards.filter((service) => service.status === "ready").length,
    needsSetup: cards.filter((service) => service.status === "needs_setup")
      .length,
  };
}

function missingSetupForService({
  keywordCount,
  subjectCount,
  pricingRuleCount,
  questionCount,
  hasOfferingDescription,
}: {
  keywordCount: number;
  subjectCount: number;
  pricingRuleCount: number;
  questionCount: number;
  hasOfferingDescription: boolean;
}): string[] {
  const missing: string[] = [];

  if (subjectCount === 0) {
    missing.push("atpažinimo temos");
  }
  if (keywordCount === 0) {
    missing.push("raktažodžiai");
  }
  if (pricingRuleCount === 0) {
    missing.push("kainodaros taisyklė");
  }
  if (questionCount === 0) {
    missing.push("sprendimo klausimai");
  }
  if (!hasOfferingDescription) {
    missing.push("atsakymas į „ar darote?“");
  }

  return missing;
}
