import {
  Prisma,
  SourceIntegrationStatus,
  SourceIntegrationTransport,
  SourceIntegrationType,
} from "@prisma/client";

export function webFormIntegrationWhere(
  integrationId: string,
): Prisma.SourceIntegrationWhereInput {
  return {
    id: integrationId,
    sourceType: SourceIntegrationType.WEB_FORM,
    transport: SourceIntegrationTransport.HTTP_WEBHOOK,
    status: SourceIntegrationStatus.ACTIVE,
  };
}

export function paslaugosIntegrationWhere(
  recipients: string[],
): Prisma.SourceIntegrationWhereInput {
  return {
    routingAddress: { in: recipients },
    sourceType: SourceIntegrationType.PASLAUGOS_LT,
    transport: SourceIntegrationTransport.RESEND_EMAIL,
    status: SourceIntegrationStatus.ACTIVE,
  };
}

export function normalizeResendRecipients(params: {
  to: string[];
  receivedFor: string[];
}): string[] {
  return Array.from(
    new Set(
      [...params.to, ...params.receivedFor]
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
