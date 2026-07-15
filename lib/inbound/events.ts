import { randomUUID } from "node:crypto";
import { InboundEventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const STALE_PROCESSING_MS = 10 * 60 * 1000;

export type ClaimedInboundEvent =
  | { status: "claimed"; eventId: string; leaseToken: string }
  | {
      status: "duplicate" | "processing";
      eventId: string;
      messageId: string | null;
      leadId: string | null;
    };

export async function claimInboundEvent(params: {
  sourceIntegrationId: string;
  externalEventId: string;
  provider: string;
  metadata?: Prisma.InputJsonValue;
  now?: Date;
}): Promise<ClaimedInboundEvent> {
  const now = params.now ?? new Date();
  const leaseToken = randomUUID();

  try {
    const event = await prisma.inboundEvent.create({
      data: {
        sourceIntegrationId: params.sourceIntegrationId,
        externalEventId: params.externalEventId,
        provider: params.provider,
        status: InboundEventStatus.PROCESSING,
        processingStartedAt: now,
        processingToken: leaseToken,
        metadata: params.metadata,
      },
    });
    return { status: "claimed", eventId: event.id, leaseToken };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  const existing = await prisma.inboundEvent.findUniqueOrThrow({
    where: {
      sourceIntegrationId_externalEventId: {
        sourceIntegrationId: params.sourceIntegrationId,
        externalEventId: params.externalEventId,
      },
    },
  });

  const claimMode = getInboundEventClaimMode({
    status: existing.status,
    processingStartedAt: existing.processingStartedAt,
    now,
  });
  if (claimMode === "duplicate") {
    return {
      status: "duplicate",
      eventId: existing.id,
      messageId: existing.messageId,
      leadId: existing.leadId,
    };
  }

  if (claimMode === "processing") {
    return {
      status: "processing",
      eventId: existing.id,
      messageId: existing.messageId,
      leadId: existing.leadId,
    };
  }

  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const claimed = await prisma.inboundEvent.updateMany({
    where: {
      id: existing.id,
      OR: [
        { status: InboundEventStatus.FAILED },
        {
          status: InboundEventStatus.PROCESSING,
          processingStartedAt: { lt: staleBefore },
        },
      ],
    },
    data: {
      status: InboundEventStatus.PROCESSING,
      processingStartedAt: now,
      processingToken: leaseToken,
      attemptCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });

  if (claimed.count === 1) {
    return { status: "claimed", eventId: existing.id, leaseToken };
  }

  return {
    status: "processing",
    eventId: existing.id,
    messageId: existing.messageId,
    leadId: existing.leadId,
  };
}

export function getInboundEventClaimMode(params: {
  status: InboundEventStatus;
  processingStartedAt: Date;
  now: Date;
}): "duplicate" | "retry" | "processing" {
  if (
    params.status === InboundEventStatus.COMPLETED ||
    params.status === InboundEventStatus.REJECTED
  ) {
    return "duplicate";
  }
  if (params.status === InboundEventStatus.FAILED) {
    return "retry";
  }
  return params.processingStartedAt.getTime() <
    params.now.getTime() - STALE_PROCESSING_MS
    ? "retry"
    : "processing";
}

export function inboundEventLeaseWhere(
  eventId: string,
  leaseToken: string,
): Prisma.InboundEventWhereInput {
  return {
    id: eventId,
    status: InboundEventStatus.PROCESSING,
    processingToken: leaseToken,
  };
}

export async function failInboundEvent(
  eventId: string,
  leaseToken: string,
  error: unknown,
): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error);
  const result = await prisma.inboundEvent.updateMany({
    where: inboundEventLeaseWhere(eventId, leaseToken),
    data: {
      status: InboundEventStatus.FAILED,
      errorCode: error instanceof Error ? error.name : "INBOUND_ERROR",
      errorMessage: message.slice(0, 500),
    },
  });
  return result.count === 1;
}

export async function rejectInboundEvent(params: {
  eventId: string;
  leaseToken: string;
  errorCode: string;
  errorMessage: string;
}): Promise<boolean> {
  const result = await prisma.inboundEvent.updateMany({
    where: inboundEventLeaseWhere(params.eventId, params.leaseToken),
    data: {
      status: InboundEventStatus.REJECTED,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage.slice(0, 500),
      completedAt: new Date(),
    },
  });
  return result.count === 1;
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export const INBOUND_STALE_PROCESSING_MS = STALE_PROCESSING_MS;
