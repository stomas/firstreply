import { OutboundIntegrationStatus, type Prisma } from "@prisma/client";
import { Resend } from "resend";
import {
  AppConfigError,
  AppNotFoundError,
  AppValidationError,
} from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import {
  mapResendDomainStatus,
  parseOutboundIntegrationInput,
  shouldTriggerDomainVerification,
} from "@/lib/outbound/helpers";

const DOMAIN_CREATE_ERROR =
  "Siuntimo domeno sukurti nepavyko. Patikrinkite domeną arba kreipkitės į administratorių.";
const DOMAIN_REFRESH_ERROR =
  "Siuntimo domeno būsenos atnaujinti nepavyko. Pabandykite dar kartą arba kreipkitės į administratorių.";

export type OutboundIntegrationDashboardItem = {
  id: string;
  name: string;
  status: OutboundIntegrationStatus;
  providerStatus: string;
  domain: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  isDefault: boolean;
  dispatchCount: number;
  lastError: string | null;
  dnsRecords: Array<{
    record: string;
    type: string;
    name: string;
    value: string;
    status: string;
    priority?: number;
  }>;
};

export async function getOutboundIntegrationDashboard(
  clientId: string,
): Promise<OutboundIntegrationDashboardItem[]> {
  assertDatabaseConfigured();
  const rows = await prisma.outboundIntegration.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { dispatches: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    providerStatus: row.providerStatus,
    domain: row.domain,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyToEmail: row.replyToEmail,
    isDefault: row.isDefault,
    dispatchCount: row._count.dispatches,
    lastError: row.lastError ? DOMAIN_REFRESH_ERROR : null,
    dnsRecords: readDnsRecords(row.dnsRecords),
  }));
}

export async function createOutboundIntegration(params: {
  clientId: string;
  name: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
}) {
  assertDatabaseConfigured();
  const input = parseOutboundIntegrationInput(params);
  const resend = getResend();
  const response = await resend.domains.create({
    name: input.domain,
    region: "eu-west-1",
    capabilities: { sending: "enabled", receiving: "disabled" },
  });
  if (response.error || !response.data) {
    console.error("[outbound-domain-create] provider request failed", {
      error: response.error,
    });
    throw new AppValidationError(DOMAIN_CREATE_ERROR);
  }
  const status = mapResendDomainStatus(response.data.status);
  try {
    return await prisma.$transaction(async (tx) => {
      const defaultCount = await tx.outboundIntegration.count({
        where: { clientId: params.clientId, isDefault: true },
      });
      return tx.outboundIntegration.create({
        data: {
          clientId: params.clientId,
          name: input.name,
          domain: input.domain,
          fromName: input.fromName,
          fromEmail: input.fromEmail,
          replyToEmail: input.replyToEmail,
          providerDomainId: response.data.id,
          providerStatus: response.data.status,
          dnsRecords: response.data.records as unknown as Prisma.InputJsonValue,
          status,
          isDefault:
            defaultCount === 0 && status === OutboundIntegrationStatus.ACTIVE,
          verifiedAt:
            status === OutboundIntegrationStatus.ACTIVE ? new Date() : null,
        },
      });
    });
  } catch (error) {
    await resend.domains.remove(response.data.id).catch(() => undefined);
    throw error;
  }
}

export async function refreshOutboundIntegration(params: {
  clientId: string;
  integrationId: string;
}): Promise<OutboundIntegrationDashboardItem> {
  const integration = await findIntegration(params);
  const resend = getResend();
  const response = await resend.domains.get(integration.providerDomainId);
  if (response.error || !response.data) {
    console.error("[outbound-domain-refresh] status request failed", {
      integrationId: integration.id,
      error: response.error,
    });
    await recordRefreshError(integration.id, DOMAIN_REFRESH_ERROR);
    throw new AppValidationError(DOMAIN_REFRESH_ERROR);
  }

  let providerStatus = response.data.status;
  if (shouldTriggerDomainVerification(providerStatus)) {
    const verify = await resend.domains.verify(integration.providerDomainId);
    if (verify.error) {
      console.error("[outbound-domain-refresh] verification request failed", {
        integrationId: integration.id,
        error: verify.error,
      });
      await recordRefreshError(integration.id, DOMAIN_REFRESH_ERROR);
      throw new AppValidationError(DOMAIN_REFRESH_ERROR);
    }
    providerStatus = "pending";
  }

  const providerMappedStatus = mapResendDomainStatus(providerStatus);
  const status =
    integration.status === OutboundIntegrationStatus.DISABLED
      ? OutboundIntegrationStatus.DISABLED
      : providerMappedStatus;
  await prisma.$transaction(async (tx) => {
    await tx.outboundIntegration.update({
      where: { id: integration.id },
      data: {
        providerStatus,
        dnsRecords: response.data.records as unknown as Prisma.InputJsonValue,
        status,
        lastError: null,
        verifiedAt:
          providerMappedStatus === OutboundIntegrationStatus.ACTIVE
            ? (integration.verifiedAt ?? new Date())
            : null,
      },
    });
    if (status === OutboundIntegrationStatus.ACTIVE) {
      const defaultCount = await tx.outboundIntegration.count({
        where: { clientId: params.clientId, isDefault: true },
      });
      if (defaultCount === 0) {
        await tx.outboundIntegration.update({
          where: { id: integration.id },
          data: { isDefault: true },
        });
      }
    }
  });

  const refreshed = (
    await getOutboundIntegrationDashboard(params.clientId)
  ).find((item) => item.id === integration.id);
  if (!refreshed) {
    throw new AppNotFoundError("Siuntimo integracija nerasta.");
  }
  return refreshed;
}

export async function setOutboundIntegrationStatus(params: {
  clientId: string;
  integrationId: string;
  enabled: boolean;
}): Promise<void> {
  const integration = await findIntegration(params);
  if (params.enabled && integration.providerStatus !== "verified") {
    throw new AppValidationError("Pirmiausia patvirtinkite domeno DNS įrašus.");
  }
  await prisma.$transaction(async (tx) => {
    const defaultCount = params.enabled
      ? await tx.outboundIntegration.count({
          where: { clientId: params.clientId, isDefault: true },
        })
      : 0;
    await tx.outboundIntegration.update({
      where: { id: integration.id },
      data: {
        status: params.enabled
          ? OutboundIntegrationStatus.ACTIVE
          : OutboundIntegrationStatus.DISABLED,
        isDefault: params.enabled
          ? integration.isDefault || defaultCount === 0
          : false,
      },
    });
  });
}

export async function setDefaultOutboundIntegration(params: {
  clientId: string;
  integrationId: string;
}): Promise<void> {
  const integration = await findIntegration(params);
  if (
    integration.status !== OutboundIntegrationStatus.ACTIVE ||
    integration.providerStatus !== "verified"
  ) {
    throw new AppValidationError(
      "Numatytasis siuntėjas turi būti aktyvus ir patvirtintas.",
    );
  }
  await prisma.$transaction([
    prisma.outboundIntegration.updateMany({
      where: { clientId: params.clientId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.outboundIntegration.update({
      where: { id: integration.id },
      data: { isDefault: true },
    }),
  ]);
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key)
    throw new AppConfigError("El. pašto siuntimo paslauga nesukonfigūruota.");
  return new Resend(key);
}

async function findIntegration(params: {
  clientId: string;
  integrationId: string;
}) {
  const integration = await prisma.outboundIntegration.findFirst({
    where: { id: params.integrationId, clientId: params.clientId },
  });
  if (!integration) throw new AppNotFoundError("Siuntimo integracija nerasta.");
  return integration;
}

async function recordRefreshError(id: string, message: string): Promise<void> {
  await prisma.outboundIntegration.update({
    where: { id },
    data: { lastError: message.slice(0, 1000) },
  });
}

function readDnsRecords(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record))
      return [];
    const row = record as Record<string, unknown>;
    if (
      !["record", "type", "name", "value", "status"].every(
        (key) => typeof row[key] === "string",
      )
    )
      return [];
    return [
      {
        record: row.record as string,
        type: row.type as string,
        name: row.name as string,
        value: row.value as string,
        status: row.status as string,
        ...(typeof row.priority === "number" ? { priority: row.priority } : {}),
      },
    ];
  });
}
