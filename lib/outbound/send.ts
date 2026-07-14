import { randomUUID } from "node:crypto";
import {
  ConversationMessageDirection,
  ConversationStatus,
  OutboundDispatchStatus,
  OutboundIntegrationStatus,
  type Prisma,
} from "@prisma/client";
import { Resend } from "resend";
import { z } from "zod";
import { AppConfigError, AppValidationError } from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import { lockLeadForUpdate } from "@/lib/inbound/lead-lock";
import {
  applyPendingOutboundDeliveryEvents,
  OUTBOUND_DISPATCH_TAG,
  reconcileProviderAcceptance,
} from "@/lib/outbound/delivery";
import {
  assertOutboundSource,
  classifyDispatchRetry,
  formatSender,
  isUncertainProviderError,
  parseOutboundSendInput,
  plainTextToSafeHtml,
} from "@/lib/outbound/helpers";

const sendableResponseStatuses = ["ready", "manual_review"];

type ReservedDispatch = {
  id: string;
  status: OutboundDispatchStatus;
  processingToken: string;
  idempotencyKey: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  replyToEmail: string;
  subject: string;
  text: string;
  responseRevisionId: string;
  conversationId: string;
  conversationVersion: number;
  conversationMessageId: string;
  createdAt: Date;
};

export type SendConversationResult = {
  dispatchId: string;
  status: "sent" | "already_sent";
  providerMessageId: string | null;
};

export async function sendConversationResponse(params: {
  clientId: string;
  sentByUserId: string;
  leadId: string;
  responseRevisionId: string;
  sendRequestId: string;
  subject: string;
  text: string;
}): Promise<SendConversationResult> {
  assertDatabaseConfigured();
  assertSendingEnabled();
  const input = parseOutboundSendInput(params);
  const reservation = await reserveDispatch({
    ...input,
    clientId: params.clientId,
    sentByUserId: params.sentByUserId,
  });

  if (
    reservation.status === OutboundDispatchStatus.SENT ||
    reservation.status === OutboundDispatchStatus.DELIVERED
  ) {
    const existing = await prisma.outboundDispatch.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    return {
      dispatchId: existing.id,
      status: "already_sent",
      providerMessageId: existing.providerMessageId,
    };
  }

  const resend = getResend();
  let response: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    response = await resend.emails.send(
      {
        from: formatSender(reservation.fromName, reservation.fromEmail),
        to: reservation.toEmail,
        replyTo: reservation.replyToEmail,
        subject: reservation.subject,
        text: reservation.text,
        html: plainTextToSafeHtml(reservation.text),
        tags: [{ name: OUTBOUND_DISPATCH_TAG, value: reservation.id }],
      },
      { idempotencyKey: reservation.idempotencyKey },
    );
  } catch (error) {
    await failLease(
      reservation,
      "TRANSPORT_UNCERTAIN",
      safeErrorMessage(error),
    );
    throw new AppValidationError(
      "Siuntimo rezultatas neaiškus. Nekartokite nauju mygtuko paspaudimu — saugus retry naudos tą patį raktą.",
    );
  }

  if (response.error || !response.data) {
    const uncertain = response.error
      ? isUncertainProviderError(response.error)
      : true;
    await failLease(
      reservation,
      uncertain
        ? "TRANSPORT_UNCERTAIN"
        : (response.error?.name ?? "PROVIDER_ERROR"),
      response.error?.message ?? "Resend negrąžino laiško ID.",
    );
    if (uncertain) {
      throw new AppValidationError(
        "Resend rezultatas neaiškus. Naudokite tik šio timeline įrašo saugų retry su tuo pačiu raktu.",
      );
    }
    throw new AppValidationError(
      `Resend laiško nepriėmė: ${response.error?.message ?? "nežinoma klaida"}`,
    );
  }

  const accepted = await acceptLease(
    reservation,
    params.leadId,
    response.data.id,
  );
  if (!accepted) {
    throw new AppValidationError(
      "Laiškas priimtas, bet lokali būsena pasikeitė. Patikrinkite pokalbio istoriją.",
    );
  }
  return {
    dispatchId: reservation.id,
    status: "sent",
    providerMessageId: response.data.id,
  };
}

async function reserveDispatch(params: {
  clientId: string;
  sentByUserId: string;
  leadId: string;
  responseRevisionId: string;
  sendRequestId: string;
  subject: string;
  text: string;
}): Promise<ReservedDispatch> {
  return prisma.$transaction(async (tx) => {
    const ownedLead = await tx.lead.findFirst({
      where: { id: params.leadId, clientId: params.clientId },
      select: { id: true },
    });
    if (!ownedLead) throw new AppValidationError("Užklausa nerasta.");
    await lockLeadForUpdate(tx, params.leadId);
    const existing = await tx.outboundDispatch.findUnique({
      where: {
        clientId_sendRequestId: {
          clientId: params.clientId,
          sendRequestId: params.sendRequestId,
        },
      },
    });
    if (existing) {
      if (
        existing.responseRevisionId !== params.responseRevisionId ||
        existing.subject !== params.subject ||
        existing.text !== params.text ||
        existing.conversationId !==
          (await conversationIdForLead(tx, params.clientId, params.leadId))
      ) {
        throw new AppValidationError(
          "Tas pats siuntimo request ID panaudotas kitam laiškui.",
        );
      }
      if (
        existing.status === OutboundDispatchStatus.FAILED &&
        existing.providerMessageId
      ) {
        throw new AppValidationError(
          "Providerio priimto, bet vėliau nepristatyto laiško kartoti tuo pačiu siuntimu negalima.",
        );
      }
      const retryDecision = classifyDispatchRetry({
        status: existing.status,
        createdAt: existing.createdAt,
        processingStartedAt: existing.processingStartedAt,
        now: new Date(),
      });
      if (retryDecision === "already_sent") {
        return existing;
      }
      if (retryDecision === "expired") {
        await tx.outboundDispatch.update({
          where: { id: existing.id },
          data: {
            status: OutboundDispatchStatus.UNKNOWN,
            errorCode: "IDEMPOTENCY_WINDOW_EXPIRED",
          },
        });
        throw new AppValidationError(
          "Nebegalima saugiai kartoti siuntimo. Patikrinkite Resend ir pažymėkite atsakymą rankiniu būdu.",
        );
      }
      if (retryDecision === "in_progress") {
        throw new AppValidationError(
          "Šis laiškas jau siunčiamas. Atnaujinkite puslapį po kelių sekundžių.",
        );
      }
      if (retryDecision === "blocked") {
        throw new AppValidationError("Šio siuntimo pakartoti negalima.");
      }
      const currentConversation = await tx.conversation.findFirst({
        where: {
          id: existing.conversationId,
          clientId: params.clientId,
          leadId: params.leadId,
        },
        select: { inboundVersion: true, status: true },
      });
      if (
        !currentConversation ||
        (currentConversation.status !== ConversationStatus.NEEDS_REPLY &&
          currentConversation.status !== ConversationStatus.MANUAL_REVIEW) ||
        currentConversation.inboundVersion !== existing.conversationVersion
      ) {
        throw new AppValidationError(
          "Pokalbis pasikeitė po pirmo siuntimo bandymo. Pakartotinai siųsti nesaugu.",
        );
      }
      const token = randomUUID();
      const claimed = await tx.outboundDispatch.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
          processingToken: existing.processingToken,
        },
        data: {
          status: OutboundDispatchStatus.SENDING,
          processingToken: token,
          processingStartedAt: new Date(),
          attemptCount: { increment: 1 },
          errorCode: null,
          errorMessage: null,
          failedAt: null,
        },
      });
      if (claimed.count !== 1)
        throw new AppValidationError("Siuntimas jau apdorojamas.");
      return {
        ...existing,
        status: OutboundDispatchStatus.SENDING,
        processingToken: token,
      };
    }

    const conversation = await tx.conversation.findFirst({
      where: { clientId: params.clientId, leadId: params.leadId },
      include: {
        sourceIntegration: { select: { sourceType: true } },
        messages: {
          orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { subject: true },
        },
      },
    });
    if (!conversation) throw new AppValidationError("Pokalbis nerastas.");
    assertOutboundSource(conversation.sourceIntegration.sourceType);
    if (
      conversation.status !== ConversationStatus.NEEDS_REPLY &&
      conversation.status !== ConversationStatus.MANUAL_REVIEW
    ) {
      throw new AppValidationError(
        "Atsakymą galima siųsti tik pokalbiui, kuriam dar reikia atsakymo.",
      );
    }
    if (conversation.inboundVersion !== conversation.responseVersion) {
      throw new AppValidationError(
        "Atsakymo juodraštis nebeatitinka naujausios kliento žinutės.",
      );
    }
    const lead = await tx.lead.findFirst({
      where: { id: params.leadId, clientId: params.clientId },
      select: { customerEmail: true },
    });
    const toEmail = lead?.customerEmail?.trim().toLowerCase();
    if (!toEmail || !z.string().email().safeParse(toEmail).success) {
      throw new AppValidationError(
        "Užklausoje nėra tinkamo kliento el. pašto.",
      );
    }
    const revision = await tx.leadResponse.findFirst({
      where: {
        id: params.responseRevisionId,
        leadId: params.leadId,
        status: { in: sendableResponseStatuses },
      },
      select: { id: true },
    });
    if (!revision)
      throw new AppValidationError("Pasirinkta atsakymo revizija nebeaktyvi.");
    const newerActive = await tx.leadResponse.count({
      where: {
        leadId: params.leadId,
        status: { in: sendableResponseStatuses },
        NOT: { id: revision.id },
      },
    });
    if (newerActive > 0)
      throw new AppValidationError(
        "Yra kita aktyvi atsakymo revizija. Atnaujinkite puslapį.",
      );

    const unfinishedDispatch = await tx.outboundDispatch.findFirst({
      where: {
        clientId: params.clientId,
        responseRevisionId: revision.id,
        OR: [
          {
            status: {
              in: [
                OutboundDispatchStatus.SENDING,
                OutboundDispatchStatus.UNKNOWN,
              ],
            },
          },
          {
            status: OutboundDispatchStatus.FAILED,
            errorCode: "TRANSPORT_UNCERTAIN",
          },
          { providerMessageId: { not: null } },
        ],
      },
      select: { id: true },
    });
    if (unfinishedDispatch) {
      throw new AppValidationError(
        "Ši revizija jau turi nebaigtą siuntimą. Naudokite jo saugų retry, o ne naują siuntimo užklausą.",
      );
    }

    const identity = await tx.outboundIntegration.findFirst({
      where: {
        clientId: params.clientId,
        isDefault: true,
        status: OutboundIntegrationStatus.ACTIVE,
        providerStatus: "verified",
      },
      orderBy: { createdAt: "asc" },
    });
    if (!identity)
      throw new AppValidationError(
        "Nėra aktyvaus, Resend patvirtinto numatytojo siuntėjo.",
      );

    const message = await tx.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        sourceIntegrationId: conversation.sourceIntegrationId,
        provider: "firstreply_outbound",
        providerMessageId: `dispatch:${params.clientId}:${params.sendRequestId}`,
        direction: ConversationMessageDirection.OUTBOUND,
        senderEmail: identity.fromEmail,
        senderName: identity.fromName,
        recipients: [toEmail] as Prisma.InputJsonValue,
        subject: params.subject,
        text: params.text,
        attachments: [] as Prisma.InputJsonValue,
        receivedAt: new Date(),
      },
    });
    const token = randomUUID();
    return tx.outboundDispatch.create({
      data: {
        clientId: params.clientId,
        leadId: params.leadId,
        conversationId: conversation.id,
        conversationMessageId: message.id,
        outboundIntegrationId: identity.id,
        responseRevisionId: revision.id,
        conversationVersion: conversation.inboundVersion,
        sentByUserId: params.sentByUserId,
        sendRequestId: params.sendRequestId,
        idempotencyKey: `fr-${params.clientId}-${params.sendRequestId}`,
        status: OutboundDispatchStatus.SENDING,
        fromName: identity.fromName,
        fromEmail: identity.fromEmail,
        toEmail,
        replyToEmail: identity.replyToEmail,
        subject: params.subject,
        text: params.text,
        processingToken: token,
      },
    });
  });
}

async function acceptLease(
  dispatch: ReservedDispatch,
  leadId: string,
  providerMessageId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, leadId);
    const now = new Date();
    const accepted = await tx.outboundDispatch.updateMany({
      where: {
        id: dispatch.id,
        status: OutboundDispatchStatus.SENDING,
        processingToken: dispatch.processingToken,
      },
      data: {
        status: OutboundDispatchStatus.SENT,
        providerMessageId,
        sentAt: now,
      },
    });
    if (accepted.count !== 1) {
      const reconciled = await tx.outboundDispatch.findUnique({
        where: { id: dispatch.id },
        select: { providerMessageId: true, sentAt: true },
      });
      return (
        reconciled?.providerMessageId === providerMessageId &&
        reconciled.sentAt !== null
      );
    }
    await reconcileProviderAcceptance(
      tx,
      { ...dispatch, leadId, providerMessageId: null, sentAt: null },
      providerMessageId,
      now,
    );
    await applyPendingOutboundDeliveryEvents(tx, dispatch.id);
    return true;
  });
}

async function failLease(
  dispatch: ReservedDispatch,
  code: string,
  message: string,
): Promise<void> {
  await prisma.outboundDispatch.updateMany({
    where: {
      id: dispatch.id,
      status: OutboundDispatchStatus.SENDING,
      processingToken: dispatch.processingToken,
    },
    data: {
      status: OutboundDispatchStatus.FAILED,
      errorCode: code.slice(0, 100),
      errorMessage: message.slice(0, 1000),
      failedAt: new Date(),
    },
  });
}

async function conversationIdForLead(
  tx: Prisma.TransactionClient,
  clientId: string,
  leadId: string,
): Promise<string | null> {
  const conversation = await tx.conversation.findFirst({
    where: { clientId, leadId },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

function assertSendingEnabled(): void {
  if (process.env.EMAIL_SENDING_ENABLED !== "true") {
    throw new AppConfigError(
      "El. laiškų siuntimas išjungtas (EMAIL_SENDING_ENABLED=false).",
    );
  }
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new AppConfigError("RESEND_API_KEY is not configured.");
  return new Resend(key);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Nežinoma transporto klaida";
}
