import {
  ConversationMessageDirection,
  ConversationStatus,
  InboundEventStatus,
  Prisma,
  SourceIntegrationStatus,
  SourceIntegrationType,
} from "@prisma/client";
import { AppNotFoundError } from "@/lib/app-errors";
import { prisma } from "@/lib/db";
import { inboundEventLeaseWhere } from "@/lib/inbound/events";
import { lockLeadForUpdate } from "@/lib/inbound/lead-lock";
import type { NormalizedInboundMessage } from "@/lib/inbound/types";
import { runLeadPipeline } from "@/lib/leads/test-pipeline";
import { getClientRules } from "@/lib/rules/get-client-rules";

const MAX_CONVERSATION_CONTEXT = 20_000;
const MAX_THREAD_REFERENCES = 100;

export async function ingestInboundMessage(params: {
  integrationId: string;
  eventId: string;
  eventLeaseToken: string;
  message: NormalizedInboundMessage;
}): Promise<{
  messageId: string;
  conversationId: string;
  leadId: string;
  duplicate: boolean;
  coalesced?: boolean;
}> {
  const integration = await prisma.sourceIntegration.findFirst({
    where: {
      id: params.integrationId,
      status: SourceIntegrationStatus.ACTIVE,
    },
    include: { client: { select: { id: true, tenantId: true } } },
  });
  if (!integration) {
    throw new AppNotFoundError("Aktyvi inbound integracija nerasta.");
  }
  if (integration.sourceType !== params.message.sourceType) {
    throw new Error("Inbound source type does not match the integration.");
  }

  const existingMessage = await prisma.conversationMessage.findUnique({
    where: {
      sourceIntegrationId_providerMessageId: {
        sourceIntegrationId: integration.id,
        providerMessageId: params.message.providerMessageId,
      },
    },
    include: { conversation: true },
  });
  if (existingMessage?.conversation.leadId) {
    const completedEvent = await prisma.inboundEvent.findFirst({
      where: {
        messageId: existingMessage.id,
        status: InboundEventStatus.COMPLETED,
      },
      select: { id: true },
    });
    if (completedEvent) {
      if (completedEvent.id === params.eventId) {
        return {
          messageId: existingMessage.id,
          conversationId: existingMessage.conversation.id,
          leadId: existingMessage.conversation.leadId,
          duplicate: true,
        };
      }
      throw new Error("Provider message is already linked to another event.");
    }
  }

  const internetMessageId = normalizeMessageId(
    params.message.internetMessageId,
  );
  const messageIdCollision =
    !existingMessage && internetMessageId
      ? await prisma.conversationMessage.findUnique({
          where: {
            sourceIntegrationId_internetMessageId: {
              sourceIntegrationId: integration.id,
              internetMessageId,
            },
          },
          select: { id: true },
        })
      : null;
  let message: NormalizedInboundMessage = messageIdCollision
    ? {
        ...params.message,
        internetMessageId: null,
        inReplyTo: null,
        references: [],
        forcedManualReviewReason: "MESSAGE_ID_COLLISION",
      }
    : params.message;

  const untrustedThreadReferences = hasUntrustedThreadReferences(message);
  if (untrustedThreadReferences) {
    message = {
      ...message,
      forcedManualReviewReason:
        message.forcedManualReviewReason ?? "UNAUTHENTICATED_THREAD_REFERENCES",
    };
  }

  const threadMatch =
    existingMessage || messageIdCollision || untrustedThreadReferences
      ? null
      : await findThreadParent({
          sourceIntegrationId: integration.id,
          senderEmail: message.senderEmail,
          inReplyTo: message.inReplyTo,
          references: message.references,
        });
  if (threadMatch?.ambiguous) {
    message = {
      ...message,
      inReplyTo: null,
      references: [],
      forcedManualReviewReason: "THREAD_REFERENCES_AMBIGUOUS",
    };
  }

  const stored = existingMessage
    ? {
        conversation: existingMessage.conversation,
        message: existingMessage,
      }
    : await storeInboundMessage({
        eventId: params.eventId,
        eventLeaseToken: params.eventLeaseToken,
        integrationId: integration.id,
        clientId: integration.clientId,
        matchedConversationId: threadMatch?.conversationId ?? null,
        message,
      });

  const lead = stored.conversation.leadId
    ? await prisma.lead.findUniqueOrThrow({
        where: { id: stored.conversation.leadId },
      })
    : await createLeadForConversation({
        conversationId: stored.conversation.id,
        clientId: integration.clientId,
        tenantId: integration.client.tenantId,
        sourceType: integration.sourceType,
        sourceName: integration.name,
        message,
      });

  const snapshot = await getConversationSnapshot(stored.conversation.id);
  const context = buildConversationContext(snapshot.messages);
  const hasAttachments = snapshot.messages.some(
    (storedMessage) => storedMessage.hasAttachments,
  );
  const forcedReason =
    stored.message.manualReviewReason ??
    message.forcedManualReviewReason ??
    (context.tooLarge ? "CONVERSATION_CONTEXT_TOO_LARGE" : null) ??
    (hasAttachments ? "INBOUND_ATTACHMENTS_UNPROCESSED" : null);

  try {
    if (
      forcedReason === "SOURCE_FORMAT_UNRECOGNIZED" ||
      forcedReason === "CONVERSATION_CONTEXT_TOO_LARGE" ||
      forcedReason === "MESSAGE_ID_COLLISION" ||
      forcedReason === "THREAD_REFERENCES_AMBIGUOUS" ||
      forcedReason === "UNAUTHENTICATED_THREAD_REFERENCES"
    ) {
      await persistManualReview({
        eventId: params.eventId,
        eventLeaseToken: params.eventLeaseToken,
        messageId: stored.message.id,
        conversationId: stored.conversation.id,
        leadId: lead.id,
        rawText: context.text,
        reason: forcedReason,
        hasAttachments,
        targetVersion: snapshot.inboundVersion,
      });
      return {
        messageId: stored.message.id,
        conversationId: stored.conversation.id,
        leadId: lead.id,
        duplicate: false,
      };
    }

    const rules = await getClientRules(integration.clientId);
    const pipeline = await runLeadPipeline({
      input: {
        serviceId: "",
        customerName: lead.customerName ?? message.customerName ?? "",
        customerEmail: lead.customerEmail ?? message.customerEmail ?? "",
        customerPhone: lead.customerPhone ?? message.customerPhone ?? "",
        city: lead.city ?? message.city ?? "",
        inquiryMessage: context.text,
        asksPrice: false,
        asksAvailability: false,
        isUrgent: false,
        hasAttachments,
        source: sourceValue(integration.sourceType),
      },
      rules,
      leadId: lead.id,
      isTest: false,
      aiOptions: {
        env: {
          ...process.env,
          SHADOW_AI_PARSE: "false",
        },
      },
    });

    const effectiveManualReason = forcedReason ?? pipeline.manualReviewReason;
    const responseStatus = effectiveManualReason
      ? "manual_review"
      : pipeline.responseStatus;

    await prisma.$transaction(async (tx) => {
      await lockLeadForUpdate(tx, lead.id);
      await claimConversationResponseVersion({
        tx,
        conversationId: stored.conversation.id,
        targetVersion: snapshot.inboundVersion,
        leadId: lead.id,
        status:
          responseStatus === "manual_review"
            ? ConversationStatus.MANUAL_REVIEW
            : ConversationStatus.NEEDS_REPLY,
        customerName: stored.conversation.customerName ?? message.customerName,
        customerEmail:
          stored.conversation.customerEmail ??
          message.customerEmail ??
          pipeline.parsedLead.contacts.email?.normalized ??
          null,
      });
      await tx.leadResponse.updateMany({
        where: {
          leadId: lead.id,
          status: { in: ["ready", "manual_review"] },
        },
        data: { status: "superseded" },
      });
      await tx.leadResponse.create({
        data: {
          leadId: lead.id,
          responseType: pipeline.responseType,
          draftText: pipeline.draftText,
          status: responseStatus,
          autoSendAllowed: effectiveManualReason
            ? false
            : pipeline.autoSendAllowed,
          manualReviewReason: effectiveManualReason,
          decisionJson: {
            decisionResult: pipeline.decisionResult,
            composed: pipeline.composed,
            trace: pipeline.trace,
          } as unknown as Prisma.InputJsonObject,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          serviceId: pipeline.parsedLead.serviceId,
          status:
            responseStatus === "manual_review"
              ? "manual_review"
              : "response_ready",
          customerName: lead.customerName ?? message.customerName,
          customerEmail:
            lead.customerEmail ??
            message.customerEmail ??
            pipeline.parsedLead.contacts.email?.normalized,
          customerPhone:
            lead.customerPhone ??
            message.customerPhone ??
            pipeline.parsedLead.contacts.phone?.normalized,
          city: pipeline.parsedLead.city,
          rawText: context.text,
          parseResult: pipeline.parsedLead as Prisma.InputJsonObject,
          decisionResult:
            pipeline.decisionResult as unknown as Prisma.InputJsonObject,
          responseDraft: pipeline.draftText,
          asksPrice: pipeline.parsedLead.asksPrice,
          asksAvailability: pipeline.parsedLead.asksAvailability,
          isUrgent: pipeline.parsedLead.isUrgent,
          hasAttachments,
          manualReviewReason: effectiveManualReason,
          errorCode: null,
        },
      });
      const completed = await tx.inboundEvent.updateMany({
        where: inboundEventLeaseWhere(params.eventId, params.eventLeaseToken),
        data: {
          status: InboundEventStatus.COMPLETED,
          completedAt: new Date(),
          messageId: stored.message.id,
          leadId: lead.id,
        },
      });
      assertEventLease(completed.count);
    });
  } catch (error) {
    if (error instanceof ConversationAdvancedError) {
      await completeCoalescedEvent({
        eventId: params.eventId,
        eventLeaseToken: params.eventLeaseToken,
        messageId: stored.message.id,
        leadId: lead.id,
      });
      return {
        messageId: stored.message.id,
        conversationId: stored.conversation.id,
        leadId: lead.id,
        duplicate: false,
        coalesced: true,
      };
    }
    await markLeadErrorIfLeaseOwned({
      eventId: params.eventId,
      eventLeaseToken: params.eventLeaseToken,
      leadId: lead.id,
      error,
    });
    throw error;
  }

  return {
    messageId: stored.message.id,
    conversationId: stored.conversation.id,
    leadId: lead.id,
    duplicate: false,
  };
}

async function findThreadParent(params: {
  sourceIntegrationId: string;
  senderEmail: string | null;
  inReplyTo: string | null;
  references: string[];
}) {
  const threadIds = normalizeThreadIds([
    params.inReplyTo,
    ...params.references,
  ]).slice(0, MAX_THREAD_REFERENCES);
  if (threadIds.length === 0 || !params.senderEmail) {
    return null;
  }
  const matches = await prisma.conversationMessage.findMany({
    where: {
      internetMessageId: { in: threadIds },
      sourceIntegrationId: params.sourceIntegrationId,
      senderEmail: params.senderEmail,
    },
    select: { conversationId: true },
  });
  const conversationIds = Array.from(
    new Set(matches.map((match) => match.conversationId)),
  );
  if (conversationIds.length > 1) {
    return { conversationId: null, ambiguous: true };
  }
  return conversationIds[0]
    ? { conversationId: conversationIds[0], ambiguous: false }
    : null;
}

async function storeInboundMessage(params: {
  eventId: string;
  eventLeaseToken: string;
  integrationId: string;
  clientId: string;
  matchedConversationId: string | null;
  message: NormalizedInboundMessage;
}) {
  return prisma.$transaction(async (tx) => {
    const conversation = params.matchedConversationId
      ? await tx.conversation.update({
          where: { id: params.matchedConversationId },
          data: {
            lastInboundAt: params.message.receivedAt,
            closedAt: null,
            inboundVersion: { increment: 1 },
          },
        })
      : await tx.conversation.create({
          data: {
            clientId: params.clientId,
            sourceIntegrationId: params.integrationId,
            subject: params.message.subject,
            customerName: params.message.customerName,
            customerEmail: params.message.customerEmail,
            lastInboundAt: params.message.receivedAt,
            inboundVersion: 1,
          },
        });

    const message = await tx.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        sourceIntegrationId: params.integrationId,
        provider: params.message.provider,
        providerMessageId: params.message.providerMessageId,
        internetMessageId: normalizeMessageId(params.message.internetMessageId),
        inReplyTo: normalizeMessageId(params.message.inReplyTo),
        references: params.message.references,
        direction: ConversationMessageDirection.INBOUND,
        senderEmail: params.message.senderEmail,
        senderName: params.message.senderName,
        recipients: params.message.recipients,
        cc: params.message.cc,
        subject: params.message.subject,
        text: params.message.text,
        attachments: params.message.attachments as Prisma.InputJsonValue,
        hasAttachments: params.message.attachments.length > 0,
        manualReviewReason: params.message.forcedManualReviewReason,
        receivedAt: params.message.receivedAt,
      },
    });

    const eventUpdated = await tx.inboundEvent.updateMany({
      where: inboundEventLeaseWhere(params.eventId, params.eventLeaseToken),
      data: { messageId: message.id },
    });
    assertEventLease(eventUpdated.count);

    return { conversation, message };
  });
}

async function createLeadForConversation(params: {
  conversationId: string;
  clientId: string;
  tenantId: string | null;
  sourceType: SourceIntegrationType;
  sourceName: string;
  message: NormalizedInboundMessage;
}) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        clientId: params.clientId,
        tenantId: params.tenantId,
        sourceType: sourceValue(params.sourceType),
        source: params.sourceName,
        isTest: false,
        status: "processing",
        customerName: params.message.customerName,
        customerEmail: params.message.customerEmail,
        customerPhone: params.message.customerPhone,
        city: params.message.city,
        originalMessage: params.message.text,
        rawText: params.message.text,
        hasAttachments: params.message.attachments.length > 0,
      },
    });
    const claimed = await tx.conversation.updateMany({
      where: { id: params.conversationId, leadId: null },
      data: { leadId: lead.id },
    });
    if (claimed.count !== 1) {
      await tx.lead.delete({ where: { id: lead.id } });
      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: params.conversationId },
        select: { lead: true },
      });
      if (!conversation.lead) {
        throw new Error("Conversation lead could not be claimed.");
      }
      return conversation.lead;
    }
    return lead;
  });
}

async function persistManualReview(params: {
  eventId: string;
  eventLeaseToken: string;
  messageId: string;
  conversationId: string;
  leadId: string;
  rawText: string;
  reason: string;
  hasAttachments: boolean;
  targetVersion: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, params.leadId);
    await claimConversationResponseVersion({
      tx,
      conversationId: params.conversationId,
      targetVersion: params.targetVersion,
      leadId: params.leadId,
      status: ConversationStatus.MANUAL_REVIEW,
      customerName: null,
      customerEmail: null,
    });
    await tx.leadResponse.updateMany({
      where: {
        leadId: params.leadId,
        status: { in: ["ready", "manual_review"] },
      },
      data: { status: "superseded" },
    });
    await tx.leadResponse.create({
      data: {
        leadId: params.leadId,
        responseType: "manual_review",
        status: "manual_review",
        autoSendAllowed: false,
        manualReviewReason: params.reason,
        decisionJson: { reason: params.reason },
      },
    });
    await tx.lead.update({
      where: { id: params.leadId },
      data: {
        status: "manual_review",
        rawText: params.rawText,
        hasAttachments: params.hasAttachments,
        manualReviewReason: params.reason,
      },
    });
    const completed = await tx.inboundEvent.updateMany({
      where: inboundEventLeaseWhere(params.eventId, params.eventLeaseToken),
      data: {
        status: InboundEventStatus.COMPLETED,
        completedAt: new Date(),
        messageId: params.messageId,
        leadId: params.leadId,
      },
    });
    assertEventLease(completed.count);
  });
}

async function getConversationSnapshot(conversationId: string) {
  return prisma.$transaction(
    async (tx) => {
      const conversation = await tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { inboundVersion: true },
      });
      const messages = await tx.conversationMessage.findMany({
        where: {
          conversationId,
          direction: ConversationMessageDirection.INBOUND,
        },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
      });
      return { inboundVersion: conversation.inboundVersion, messages };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function claimConversationResponseVersion(params: {
  tx: Prisma.TransactionClient;
  conversationId: string;
  targetVersion: number;
  leadId: string;
  status: ConversationStatus;
  customerName: string | null;
  customerEmail: string | null;
}): Promise<void> {
  const claimed = await params.tx.conversation.updateMany({
    where: conversationResponseVersionWhere(
      params.conversationId,
      params.targetVersion,
    ),
    data: {
      leadId: params.leadId,
      status: params.status,
      responseVersion: params.targetVersion,
      ...(params.customerName ? { customerName: params.customerName } : {}),
      ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
    },
  });
  if (claimed.count !== 1) {
    throw new ConversationAdvancedError();
  }
}

async function completeCoalescedEvent(params: {
  eventId: string;
  eventLeaseToken: string;
  messageId: string;
  leadId: string;
}): Promise<void> {
  await prisma.inboundEvent.updateMany({
    where: inboundEventLeaseWhere(params.eventId, params.eventLeaseToken),
    data: {
      status: InboundEventStatus.COMPLETED,
      completedAt: new Date(),
      messageId: params.messageId,
      leadId: params.leadId,
      errorCode: "COALESCED_BY_NEWER_MESSAGE",
      errorMessage: "A newer conversation snapshot produced the active draft.",
    },
  });
}

async function markLeadErrorIfLeaseOwned(params: {
  eventId: string;
  eventLeaseToken: string;
  leadId: string;
  error: unknown;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, params.leadId);
    const event = await tx.inboundEvent.findFirst({
      where: inboundEventLeaseWhere(params.eventId, params.eventLeaseToken),
      select: { id: true },
    });
    if (!event) {
      return;
    }
    await tx.lead.update({
      where: { id: params.leadId },
      data: {
        status: "error",
        errorCode:
          params.error instanceof Error ? params.error.name : "INBOUND_ERROR",
        manualReviewReason:
          params.error instanceof Error
            ? params.error.message.slice(0, 500)
            : String(params.error),
      },
    });
  });
}

function assertEventLease(updatedCount: number): void {
  if (updatedCount !== 1) {
    throw new LostInboundEventLeaseError();
  }
}

class LostInboundEventLeaseError extends Error {
  constructor() {
    super("Inbound event processing lease is no longer active.");
    this.name = "LostInboundEventLeaseError";
  }
}

class ConversationAdvancedError extends Error {
  constructor() {
    super("A newer inbound message already advanced this conversation.");
    this.name = "ConversationAdvancedError";
  }
}

function buildConversationContext(
  messages: Array<{ subject: string | null; text: string }>,
): { text: string; tooLarge: boolean } {
  const text = messages
    .map((message, index) =>
      [
        index === 0 && message.subject ? `Tema: ${message.subject}` : null,
        message.text,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n--- Kliento tęsinys ---\n\n")
    .trim();
  return {
    text: text.slice(0, MAX_CONVERSATION_CONTEXT),
    tooLarge: text.length > MAX_CONVERSATION_CONTEXT,
  };
}

function sourceValue(sourceType: SourceIntegrationType): string {
  return sourceType === SourceIntegrationType.WEB_FORM
    ? "web_form"
    : "paslaugos_lt";
}

export function normalizeMessageId(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function normalizeThreadIds(values: Array<string | null>): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeMessageId)
        .filter((value): value is string => !!value),
    ),
  );
}

export function hasUntrustedThreadReferences(
  message: Pick<
    NormalizedInboundMessage,
    "inReplyTo" | "references" | "threadReferencesTrusted"
  >,
): boolean {
  return Boolean(
    !message.threadReferencesTrusted &&
      (normalizeMessageId(message.inReplyTo) ||
        normalizeThreadIds(message.references).length),
  );
}

export function conversationResponseVersionWhere(
  conversationId: string,
  targetVersion: number,
): Prisma.ConversationWhereInput {
  return {
    id: conversationId,
    inboundVersion: targetVersion,
    responseVersion: { lt: targetVersion },
  };
}

export const CONVERSATION_CONTEXT_MAX_LENGTH = MAX_CONVERSATION_CONTEXT;
export const THREAD_REFERENCE_MAX_COUNT = MAX_THREAD_REFERENCES;
