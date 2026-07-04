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

  const [services, pricingRules, decisionRequirements, availabilityRules] =
    await Promise.all([
      prisma.service.findMany({
        where: { clientId, active: true },
        orderBy: { name: "asc" },
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
    ]);

  return {
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      active: service.active,
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
