import { randomBytes } from "node:crypto";
import {
  SourceIntegrationStatus,
  SourceIntegrationTransport,
  SourceIntegrationType,
} from "@prisma/client";
import { AppConfigError, AppNotFoundError } from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import {
  assertInboundSigningMasterSecret,
  deriveWebFormSecret,
} from "@/lib/inbound/auth";

export type IntegrationDashboardItem = {
  id: string;
  sourceType: SourceIntegrationType;
  transport: SourceIntegrationTransport;
  name: string;
  status: SourceIntegrationStatus;
  routingAddress: string | null;
  webhookUrl: string | null;
  signingSecret: string | null;
  messageCount: number;
  eventCount: number;
  lastEvent: {
    status: string;
    errorCode: string | null;
    createdAt: string;
  } | null;
};

export async function getIntegrationDashboard(
  clientId: string,
): Promise<IntegrationDashboardItem[]> {
  assertDatabaseConfigured();
  const integrations = await prisma.sourceIntegration.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { messages: true, inboundEvents: true } },
      inboundEvents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, errorCode: true, createdAt: true },
      },
    },
  });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

  return integrations.map((integration) => {
    let signingSecret: string | null = null;
    if (
      integration.sourceType === SourceIntegrationType.WEB_FORM &&
      process.env.INBOUND_SIGNING_MASTER_SECRET?.trim()
    ) {
      signingSecret = deriveWebFormSecret({
        integrationId: integration.id,
        secretVersion: integration.secretVersion,
      });
    }

    const lastEvent = integration.inboundEvents[0] ?? null;
    return {
      id: integration.id,
      sourceType: integration.sourceType,
      transport: integration.transport,
      name: integration.name,
      status: integration.status,
      routingAddress: integration.routingAddress,
      webhookUrl:
        integration.sourceType === SourceIntegrationType.WEB_FORM
          ? `${baseUrl}/api/integrations/inbound/web-form/${integration.id}`
          : null,
      signingSecret,
      messageCount: integration._count.messages,
      eventCount: integration._count.inboundEvents,
      lastEvent: lastEvent
        ? {
            status: lastEvent.status,
            errorCode: lastEvent.errorCode,
            createdAt: lastEvent.createdAt.toISOString(),
          }
        : null,
    };
  });
}

export async function createWebFormIntegration(params: {
  clientId: string;
  name: string;
}) {
  assertDatabaseConfigured();
  requireSigningMasterSecret();
  return prisma.sourceIntegration.create({
    data: {
      clientId: params.clientId,
      sourceType: SourceIntegrationType.WEB_FORM,
      transport: SourceIntegrationTransport.HTTP_WEBHOOK,
      name: normalizeIntegrationName(params.name, "Svetainės forma"),
    },
  });
}

export async function createPaslaugosLtIntegration(params: {
  clientId: string;
  name: string;
}) {
  assertDatabaseConfigured();
  return prisma.sourceIntegration.create({
    data: {
      clientId: params.clientId,
      sourceType: SourceIntegrationType.PASLAUGOS_LT,
      transport: SourceIntegrationTransport.RESEND_EMAIL,
      name: normalizeIntegrationName(params.name, "Paslaugos.lt"),
      routingAddress: generatePaslaugosRoutingAddress(),
    },
  });
}

export async function setSourceIntegrationStatus(params: {
  clientId: string;
  integrationId: string;
  status: SourceIntegrationStatus;
}): Promise<void> {
  const result = await prisma.sourceIntegration.updateMany({
    where: { id: params.integrationId, clientId: params.clientId },
    data: { status: params.status },
  });
  if (result.count !== 1) {
    throw new AppNotFoundError("Integracija nerasta.");
  }
}

export async function rotateSourceIntegration(params: {
  clientId: string;
  integrationId: string;
}): Promise<void> {
  const integration = await prisma.sourceIntegration.findFirst({
    where: { id: params.integrationId, clientId: params.clientId },
  });
  if (!integration) {
    throw new AppNotFoundError("Integracija nerasta.");
  }

  if (integration.sourceType === SourceIntegrationType.WEB_FORM) {
    requireSigningMasterSecret();
    await prisma.sourceIntegration.update({
      where: { id: integration.id },
      data: { secretVersion: { increment: 1 } },
    });
    return;
  }

  await prisma.sourceIntegration.update({
    where: { id: integration.id },
    data: { routingAddress: generatePaslaugosRoutingAddress() },
  });
}

export function normalizeIntegrationName(
  value: string,
  fallback: string,
): string {
  const normalized = value.trim();
  return (normalized || fallback).slice(0, 120);
}

export function generatePaslaugosRoutingAddress(params?: {
  domain?: string;
  randomToken?: string;
}): string {
  const domain = (
    params?.domain ?? process.env.RESEND_INBOUND_DOMAIN?.trim()
  )?.toLowerCase();
  if (!domain) {
    throw new AppConfigError("RESEND_INBOUND_DOMAIN is not configured.");
  }
  const token = params?.randomToken ?? randomBytes(16).toString("hex");
  return `p-${token}@${domain}`;
}

function requireSigningMasterSecret(): void {
  assertInboundSigningMasterSecret();
}
