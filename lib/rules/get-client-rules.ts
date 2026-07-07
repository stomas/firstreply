import type { Prisma } from "@prisma/client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import type { ClientRules, RuleJson } from "@/lib/rules/types";

export type RuleCounts = {
  activeServices: number;
  pricingRules: number;
  decisionRequirements: number;
  availabilityRules: number;
};

export async function getClientRules(clientId: string): Promise<ClientRules> {
  assertDatabaseConfigured();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true },
  });
  const tenantId = client?.tenantId ?? null;

  const [
    services,
    serviceSubjects,
    pricingRules,
    decisionRequirements,
    availabilityRules,
    locationZones,
    scheduleRules,
    autosendPolicies,
    responseTemplates,
  ] = await Promise.all([
    prisma.service.findMany({
      where: { clientId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceSubject.findMany({
      where: { service: { clientId, active: true } },
      orderBy: [{ serviceId: "asc" }, { subjectKey: "asc" }],
    }),
    prisma.pricingRule.findMany({
      where: { clientId, active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.decisionRequirement.findMany({
      where: { clientId, active: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.availabilityRule.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    }),
    tenantId
      ? prisma.locationZone.findMany({
          where: { tenantId },
          orderBy: { adminUnitCode: "asc" },
        })
      : [],
    tenantId
      ? prisma.scheduleRule.findMany({
          where: { tenantId },
          orderBy: { createdAt: "asc" },
        })
      : [],
    tenantId
      ? prisma.autosendPolicy.findMany({
          where: { tenantId },
          orderBy: { createdAt: "asc" },
        })
      : [],
    tenantId
      ? prisma.responseTemplate.findMany({
          where: { tenantId, active: true },
          orderBy: { templateKey: "asc" },
        })
      : [],
  ]);

  return {
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      label: service.label,
      keywords: Array.isArray(service.keywords)
        ? service.keywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : [],
      active: service.active,
    })),
    serviceSubjects: serviceSubjects.map((subject) => ({
      serviceId: subject.serviceId,
      subjectKey: subject.subjectKey,
      labelLt: subject.labelLt,
      descriptionLt: subject.descriptionLt,
      synonyms: Array.isArray(subject.synonyms)
        ? subject.synonyms.filter(
            (synonym): synonym is string => typeof synonym === "string",
          )
        : [],
    })),
    pricingRules: pricingRules.map((rule) => ({
      id: rule.id,
      serviceId: rule.serviceId,
      name: rule.name,
      priceMin: decimalToNumber(rule.priceMin),
      priceMax: decimalToNumber(rule.priceMax),
      unit: rule.unit,
      conditions: rule.conditions as RuleJson,
      exclusions: rule.exclusions as RuleJson,
      disclaimerText: rule.disclaimerText,
      autoSendAllowed: rule.autoSendAllowed,
      active: rule.active,
      rule: rule.rule as RuleJson,
    })),
    decisionRequirements: decisionRequirements.map((requirement) => ({
      id: requirement.id,
      serviceId: requirement.serviceId,
      requirementKey: requirement.requirementKey,
      label: requirement.label,
      requiredFor: requirement.requiredFor,
      questionTextIfMissing: requirement.questionTextIfMissing,
      blocksAutoSend: requirement.blocksAutoSend,
      priority: requirement.priority,
      active: requirement.active,
      required: requirement.required,
      affectsPrice: requirement.affectsPrice,
      expectedFact: requirement.expectedFact as RuleJson,
      validation: requirement.validation as RuleJson,
    })),
    availabilityRules: availabilityRules.map((rule) => ({
      id: rule.id,
      serviceId: rule.serviceId,
      location: rule.location,
      status: rule.status,
      earliestStartText: rule.earliestStartText,
      noteForCustomer: rule.noteForCustomer,
      validUntil: rule.validUntil,
      autoSendAllowed: rule.autoSendAllowed,
    })),
    locationZones: locationZones.map((zone) => ({
      adminUnitCode: zone.adminUnitCode,
      zone: zone.zone,
      travelFeeEur: decimalToNumber(zone.travelFeeEur) ?? 0,
      served: zone.served,
    })),
    scheduleRules: scheduleRules.map((rule) => ({
      rule: rule.rule as RuleJson,
    })),
    autosendPolicies: autosendPolicies.map((policy) => ({
      policy: policy.policy as RuleJson,
    })),
    responseTemplates: responseTemplates.map((template) => ({
      templateKey: template.templateKey,
      body: template.body,
      active: template.active,
    })),
  };
}

export async function getClientRuleCounts(
  clientId: string,
): Promise<RuleCounts> {
  assertDatabaseConfigured();

  const [
    activeServices,
    pricingRules,
    decisionRequirements,
    availabilityRules,
  ] = await Promise.all([
    prisma.service.count({ where: { clientId, active: true } }),
    prisma.pricingRule.count({ where: { clientId, active: true } }),
    prisma.decisionRequirement.count({ where: { clientId, active: true } }),
    prisma.availabilityRule.count({ where: { clientId } }),
  ]);

  return {
    activeServices,
    pricingRules,
    decisionRequirements,
    availabilityRules,
  };
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}
