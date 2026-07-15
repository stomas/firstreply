import {
  ConversationActivityType,
  ConversationStatus,
  OutboundDispatchStatus,
  Prisma,
} from "@prisma/client";
import type { WebhookEventPayload } from "resend";
import { prisma } from "@/lib/db";
import { lockLeadForUpdate } from "@/lib/inbound/lead-lock";

export const OUTBOUND_DISPATCH_TAG = "firstreply_dispatch_id";

export type SupportedDeliveryEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.failed"
  | "email.complained"
  | "email.suppressed";

type DeliveryWebhookEvent = Extract<
  WebhookEventPayload,
  { type: SupportedDeliveryEventType }
>;

type DeliveryTransition = {
  apply: boolean;
  nextStatus: OutboundDispatchStatus | null;
};

export function isSupportedDeliveryEvent(
  event: WebhookEventPayload,
): event is DeliveryWebhookEvent {
  return [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.failed",
    "email.complained",
    "email.suppressed",
  ].includes(event.type);
}

export function getDeliveryTransition(params: {
  currentStatus: OutboundDispatchStatus;
  lastEventAt: Date | null;
  eventType: SupportedDeliveryEventType;
  eventCreatedAt: Date;
}): DeliveryTransition {
  if (
    params.lastEventAt &&
    params.eventCreatedAt.getTime() < params.lastEventAt.getTime()
  ) {
    return { apply: false, nextStatus: null };
  }
  if (params.currentStatus === OutboundDispatchStatus.SENDING) {
    return { apply: false, nextStatus: null };
  }
  if (
    params.currentStatus === OutboundDispatchStatus.COMPLAINED ||
    params.currentStatus === OutboundDispatchStatus.BOUNCED
  ) {
    return { apply: false, nextStatus: null };
  }
  if (
    params.currentStatus === OutboundDispatchStatus.FAILED &&
    params.lastEventAt
  ) {
    return { apply: false, nextStatus: null };
  }

  if (params.eventType === "email.complained") {
    return { apply: true, nextStatus: OutboundDispatchStatus.COMPLAINED };
  }
  if (params.eventType === "email.bounced") {
    return { apply: true, nextStatus: OutboundDispatchStatus.BOUNCED };
  }
  if (
    params.eventType === "email.failed" ||
    params.eventType === "email.suppressed"
  ) {
    return { apply: true, nextStatus: OutboundDispatchStatus.FAILED };
  }
  if (params.eventType === "email.delivered") {
    return { apply: true, nextStatus: OutboundDispatchStatus.DELIVERED };
  }
  if (params.eventType === "email.sent") {
    return {
      apply: true,
      nextStatus:
        params.currentStatus === OutboundDispatchStatus.DELIVERED
          ? OutboundDispatchStatus.DELIVERED
          : OutboundDispatchStatus.SENT,
    };
  }
  if (
    params.eventType === "email.delivery_delayed" &&
    params.currentStatus === OutboundDispatchStatus.DELIVERED
  ) {
    return { apply: false, nextStatus: null };
  }
  return { apply: true, nextStatus: params.currentStatus };
}

export async function processResendDeliveryEvent(params: {
  externalEventId: string;
  event: DeliveryWebhookEvent;
}): Promise<
  | { status: "completed" | "duplicate"; dispatchId: string }
  | {
      status:
        | "ignored_unknown_message"
        | "ignored_recipient_mismatch"
        | "ignored_message_mismatch";
      dispatchId?: string;
    }
> {
  const providerMessageId = params.event.data.email_id;
  const taggedDispatchId = params.event.data.tags?.[OUTBOUND_DISPATCH_TAG];
  const candidates = await prisma.outboundDispatch.findMany({
    where: {
      OR: [
        { providerMessageId },
        ...(taggedDispatchId ? [{ id: taggedDispatchId }] : []),
      ],
    },
    take: 2,
  });
  if (candidates.length === 0) return { status: "ignored_unknown_message" };
  if (candidates.length !== 1) return { status: "ignored_message_mismatch" };
  const candidate = candidates[0]!;
  if (taggedDispatchId && candidate.id !== taggedDispatchId) {
    return { status: "ignored_message_mismatch", dispatchId: candidate.id };
  }
  if (!matchesProviderMessage(candidate.providerMessageId, providerMessageId)) {
    return { status: "ignored_message_mismatch", dispatchId: candidate.id };
  }
  const recipients = params.event.data.to.map(normalizeEmail).filter(Boolean);
  if (!matchesDeliveryRecipient(recipients, candidate.toEmail)) {
    return { status: "ignored_recipient_mismatch", dispatchId: candidate.id };
  }
  const eventCreatedAt = new Date(params.event.created_at);
  if (!Number.isFinite(eventCreatedAt.getTime())) {
    return { status: "ignored_unknown_message" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockLeadForUpdate(tx, candidate.leadId);
      const dispatch = await tx.outboundDispatch.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      await reconcileProviderAcceptance(
        tx,
        dispatch,
        providerMessageId,
        eventCreatedAt,
      );
      await tx.outboundDeliveryEvent.create({
        data: {
          clientId: dispatch.clientId,
          outboundDispatchId: dispatch.id,
          provider: "resend",
          externalEventId: params.externalEventId,
          providerMessageId,
          eventType: params.event.type,
          eventCreatedAt,
          recipient: recipients[0]!,
          metadata: deliveryMetadata(params.event),
        },
      });
      await applyPendingOutboundDeliveryEvents(tx, dispatch.id);
    });
    return { status: "completed", dispatchId: candidate.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await prisma.outboundDeliveryEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: "resend",
            externalEventId: params.externalEventId,
          },
        },
        select: { outboundDispatchId: true },
      });
      if (duplicate?.outboundDispatchId === candidate.id) {
        return { status: "duplicate", dispatchId: candidate.id };
      }
    }
    if (error instanceof ProviderMessageMismatchError) {
      return { status: "ignored_message_mismatch" };
    }
    throw error;
  }
}

export async function reconcileProviderAcceptance(
  tx: Prisma.TransactionClient,
  dispatch: {
    id: string;
    leadId: string;
    conversationId: string;
    conversationMessageId: string;
    responseRevisionId: string;
    conversationVersion: number;
    providerMessageId: string | null;
    sentAt: Date | null;
    text: string;
  },
  providerMessageId: string,
  acceptedAt: Date,
): Promise<void> {
  if (
    dispatch.providerMessageId &&
    dispatch.providerMessageId !== providerMessageId
  ) {
    throw new ProviderMessageMismatchError();
  }

  await tx.outboundDispatch.update({
    where: { id: dispatch.id },
    data: {
      providerMessageId,
      ...(!dispatch.sentAt
        ? {
            status: OutboundDispatchStatus.SENT,
            sentAt: acceptedAt,
            failedAt: null,
            errorCode: null,
            errorMessage: null,
          }
        : {}),
    },
  });
  await tx.conversationMessage.update({
    where: { id: dispatch.conversationMessageId },
    data: { provider: "resend", providerMessageId },
  });
  if (dispatch.sentAt) return;

  await tx.leadResponse.update({
    where: { id: dispatch.responseRevisionId },
    data: { status: "sent", sentText: dispatch.text },
  });
  const conversation = await tx.conversation.findUniqueOrThrow({
    where: { id: dispatch.conversationId },
    select: { inboundVersion: true, firstResponseAt: true },
  });
  if (conversation.inboundVersion === dispatch.conversationVersion) {
    await tx.leadResponse.updateMany({
      where: {
        leadId: dispatch.leadId,
        id: { not: dispatch.responseRevisionId },
        status: { in: ["ready", "manual_review"] },
      },
      data: { status: "superseded" },
    });
  }
  const conversationUpdated = await tx.conversation.updateMany({
    where: {
      id: dispatch.conversationId,
      inboundVersion: dispatch.conversationVersion,
      status: {
        in: [ConversationStatus.NEEDS_REPLY, ConversationStatus.MANUAL_REVIEW],
      },
    },
    data: {
      status: ConversationStatus.WAITING_CUSTOMER,
      responseVersion: dispatch.conversationVersion,
      firstResponseAt: conversation.firstResponseAt ?? acceptedAt,
      closedAt: null,
    },
  });
  if (conversationUpdated.count === 1) {
    await tx.lead.update({
      where: { id: dispatch.leadId },
      data: {
        status: "answered",
        responseDraft: dispatch.text,
        responseSentAt: acceptedAt,
      },
    });
  }
}

export function matchesProviderMessage(
  storedProviderMessageId: string | null,
  eventProviderMessageId: string,
): boolean {
  return (
    storedProviderMessageId === null ||
    storedProviderMessageId === eventProviderMessageId
  );
}

export function matchesDeliveryRecipient(
  eventRecipients: string[],
  expectedRecipient: string,
): boolean {
  return (
    eventRecipients.length === 1 &&
    normalizeEmail(eventRecipients[0] ?? "") ===
      normalizeEmail(expectedRecipient)
  );
}

export async function applyPendingOutboundDeliveryEvents(
  tx: Prisma.TransactionClient,
  dispatchId: string,
): Promise<void> {
  const events = await tx.outboundDeliveryEvent.findMany({
    where: { outboundDispatchId: dispatchId, stateAppliedAt: null },
    orderBy: [{ eventCreatedAt: "asc" }, { createdAt: "asc" }],
  });
  for (const event of events) {
    const dispatch = await tx.outboundDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
    });
    if (dispatch.status === OutboundDispatchStatus.SENDING) return;

    const transition = getDeliveryTransition({
      currentStatus: dispatch.status,
      lastEventAt: dispatch.lastDeliveryEventAt,
      eventType: event.eventType as SupportedDeliveryEventType,
      eventCreatedAt: event.eventCreatedAt,
    });
    const appliedAt = new Date();
    if (!transition.apply || !transition.nextStatus) {
      await tx.outboundDeliveryEvent.update({
        where: { id: event.id },
        data: { stateAppliedAt: appliedAt },
      });
      continue;
    }

    const failure = failureDetails(
      event.eventType as SupportedDeliveryEventType,
      event.metadata,
    );
    await tx.outboundDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: transition.nextStatus,
        lastDeliveryEventType: event.eventType,
        lastDeliveryEventAt: event.eventCreatedAt,
        ...(transition.nextStatus === OutboundDispatchStatus.DELIVERED
          ? { deliveredAt: event.eventCreatedAt }
          : {}),
        ...(failure
          ? {
              failedAt: event.eventCreatedAt,
              errorCode: failure.code,
              errorMessage: failure.message,
            }
          : {}),
      },
    });
    await tx.outboundDeliveryEvent.update({
      where: { id: event.id },
      data: { stateAppliedAt: appliedAt },
    });
    if (failure) {
      await applyDeliveryFailureToConversation(tx, dispatch, failure);
    }
  }
}

async function applyDeliveryFailureToConversation(
  tx: Prisma.TransactionClient,
  dispatch: {
    id: string;
    leadId: string;
    conversationId: string;
    conversationVersion: number;
    createdAt: Date;
  },
  failure: {
    code: string;
    message: string;
    activity: ConversationActivityType;
  },
): Promise<void> {
  await tx.conversationActivity.create({
    data: {
      conversationId: dispatch.conversationId,
      type: failure.activity,
      note: failure.message,
    },
  });
  const newerDispatch = await tx.outboundDispatch.count({
    where: {
      conversationId: dispatch.conversationId,
      createdAt: { gt: dispatch.createdAt },
      status: {
        in: [
          OutboundDispatchStatus.SENDING,
          OutboundDispatchStatus.SENT,
          OutboundDispatchStatus.DELIVERED,
        ],
      },
    },
  });
  if (newerDispatch > 0) return;
  const conversationUpdated = await tx.conversation.updateMany({
    where: {
      id: dispatch.conversationId,
      status: ConversationStatus.WAITING_CUSTOMER,
      inboundVersion: dispatch.conversationVersion,
      responseVersion: dispatch.conversationVersion,
    },
    data: { status: ConversationStatus.MANUAL_REVIEW },
  });
  if (conversationUpdated.count !== 1) return;
  await tx.lead.update({
    where: { id: dispatch.leadId },
    data: {
      status: "delivery_failed",
      manualReviewReason: failure.code,
    },
  });
}

function failureDetails(
  eventType: SupportedDeliveryEventType,
  metadata: Prisma.JsonValue | null,
): {
  code: string;
  message: string;
  activity: ConversationActivityType;
} | null {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const detail =
    typeof record.message === "string"
      ? record.message
      : typeof record.reason === "string"
        ? record.reason
        : "Resend nepristatė laiško.";
  if (eventType === "email.bounced") {
    return {
      code: "EMAIL_BOUNCED",
      message: detail.slice(0, 500),
      activity: ConversationActivityType.DELIVERY_BOUNCED,
    };
  }
  if (eventType === "email.complained") {
    return {
      code: "EMAIL_COMPLAINED",
      message: "Gavėjas pažymėjo laišką kaip nepageidaujamą.",
      activity: ConversationActivityType.DELIVERY_COMPLAINED,
    };
  }
  if (eventType === "email.suppressed") {
    return {
      code: "EMAIL_SUPPRESSED",
      message: detail.slice(0, 500),
      activity: ConversationActivityType.DELIVERY_SUPPRESSED,
    };
  }
  if (eventType === "email.failed") {
    return {
      code: "EMAIL_DELIVERY_FAILED",
      message: detail.slice(0, 500),
      activity: ConversationActivityType.DELIVERY_FAILED,
    };
  }
  return null;
}

function deliveryMetadata(event: DeliveryWebhookEvent): Prisma.InputJsonValue {
  if (event.type === "email.bounced") {
    return {
      type: event.data.bounce.type,
      subType: event.data.bounce.subType,
      message: event.data.bounce.message,
    };
  }
  if (event.type === "email.failed") {
    return { reason: event.data.failed.reason };
  }
  if (event.type === "email.suppressed") {
    return {
      type: event.data.suppressed.type,
      message: event.data.suppressed.message,
    };
  }
  return { eventType: event.type };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

class ProviderMessageMismatchError extends Error {}
