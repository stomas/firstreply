import type { Prisma } from "@prisma/client";
import { AppNotFoundError } from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export type LeadDetail = {
  id: string;
  createdAt: string;
  sourceType: string;
  isTest: boolean;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  city: string | null;
  originalMessage: string;
  parseResult: Prisma.JsonValue | null;
  asksPrice: boolean | null;
  asksAvailability: boolean | null;
  isUrgent: boolean | null;
  hasAttachments: boolean | null;
  manualReviewReason: string | null;
  service: {
    id: string;
    name: string;
  } | null;
  responses: Array<{
    id: string;
    createdAt: string;
    responseType: string;
    draftText: string | null;
    sentText: string | null;
    status: string;
    autoSendAllowed: boolean;
    manualReviewReason: string | null;
    decisionJson: Prisma.JsonValue | null;
  }>;
  relatedRules: {
    pricingRules: Array<{
      id: string;
      name: string;
      priceMin: number | null;
      priceMax: number | null;
      unit: string | null;
      autoSendAllowed: boolean;
    }>;
    decisionRequirements: Array<{
      id: string;
      requirementKey: string;
      label: string;
      questionTextIfMissing: string;
      blocksAutoSend: boolean;
      priority: number;
    }>;
    availabilityRules: Array<{
      id: string;
      location: string | null;
      status: string;
      earliestStartText: string | null;
      validUntil: string | null;
      autoSendAllowed: boolean;
    }>;
  };
};

export async function getLeadDetail(
  clientId: string,
  leadId: string,
): Promise<LeadDetail> {
  assertDatabaseConfigured();

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, clientId },
    include: {
      service: true,
      responses: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!lead) {
    throw new AppNotFoundError("Lead not found.");
  }

  const [pricingRules, decisionRequirements, availabilityRules] = lead.serviceId
    ? await Promise.all([
        prisma.pricingRule.findMany({
          where: { clientId, serviceId: lead.serviceId, active: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.decisionRequirement.findMany({
          where: { clientId, serviceId: lead.serviceId, active: true },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        }),
        prisma.availabilityRule.findMany({
          where: { clientId, serviceId: lead.serviceId },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], [], []];

  return {
    id: lead.id,
    createdAt: lead.createdAt.toISOString(),
    sourceType: lead.sourceType,
    isTest: lead.isTest,
    status: lead.status,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    customerPhone: lead.customerPhone,
    city: lead.city,
    originalMessage: lead.originalMessage,
    parseResult: lead.parseResult ?? lead.parsedJson,
    asksPrice: lead.asksPrice,
    asksAvailability: lead.asksAvailability,
    isUrgent: lead.isUrgent,
    hasAttachments: lead.hasAttachments,
    manualReviewReason: lead.manualReviewReason,
    service: lead.service
      ? {
          id: lead.service.id,
          name: lead.service.name,
        }
      : null,
    responses: lead.responses.map((response) => ({
      id: response.id,
      createdAt: response.createdAt.toISOString(),
      responseType: response.responseType,
      draftText: response.draftText,
      sentText: response.sentText,
      status: response.status,
      autoSendAllowed: response.autoSendAllowed,
      manualReviewReason: response.manualReviewReason,
      decisionJson: response.decisionJson,
    })),
    relatedRules: {
      pricingRules: pricingRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priceMin: rule.priceMin === null ? null : Number(rule.priceMin),
        priceMax: rule.priceMax === null ? null : Number(rule.priceMax),
        unit: rule.unit,
        autoSendAllowed: rule.autoSendAllowed,
      })),
      decisionRequirements: decisionRequirements.map((requirement) => ({
        id: requirement.id,
        requirementKey: requirement.requirementKey,
        label: requirement.label,
        questionTextIfMissing: requirement.questionTextIfMissing,
        blocksAutoSend: requirement.blocksAutoSend,
        priority: requirement.priority,
      })),
      availabilityRules: availabilityRules.map((rule) => ({
        id: rule.id,
        location: rule.location,
        status: rule.status,
        earliestStartText: rule.earliestStartText,
        validUntil: rule.validUntil?.toISOString() ?? null,
        autoSendAllowed: rule.autoSendAllowed,
      })),
    },
  };
}
