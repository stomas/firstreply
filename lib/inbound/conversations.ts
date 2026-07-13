import { ConversationActivityType, ConversationStatus } from "@prisma/client";
import { AppNotFoundError, AppValidationError } from "@/lib/app-errors";
import { prisma } from "@/lib/db";
import { lockLeadForUpdate } from "@/lib/inbound/lead-lock";

export async function markConversationAnsweredExternally(params: {
  clientId: string;
  leadId: string;
  actorUserId: string;
  note: string;
}): Promise<void> {
  const conversation = await findConversation(params.clientId, params.leadId);
  assertCanMarkAnsweredExternally(conversation.status);
  const note = params.note.trim();
  if (note.length > 500) {
    throw new AppValidationError("Pastaba gali būti iki 500 simbolių.");
  }
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, params.leadId);
    const currentConversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { firstResponseAt: true, inboundVersion: true },
    });
    await tx.conversationActivity.create({
      data: {
        conversationId: conversation.id,
        actorUserId: params.actorUserId,
        type: ConversationActivityType.ANSWERED_EXTERNALLY,
        note: note || null,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.WAITING_CUSTOMER,
        firstResponseAt: currentConversation.firstResponseAt ?? now,
        responseVersion: currentConversation.inboundVersion,
        closedAt: null,
      },
    });
    await tx.leadResponse.updateMany({
      where: {
        leadId: params.leadId,
        status: { in: ["ready", "manual_review"] },
      },
      data: { status: "superseded" },
    });
    await tx.lead.update({
      where: { id: params.leadId },
      data: { status: "answered_externally" },
    });
  });
}

export function assertCanMarkAnsweredExternally(
  status: ConversationStatus,
): void {
  if (status === ConversationStatus.CLOSED) {
    throw new AppValidationError(
      "Prieš žymėdami atsakymą atidarykite pokalbį iš naujo.",
    );
  }
}

export async function reopenConversation(params: {
  clientId: string;
  leadId: string;
  actorUserId: string;
}): Promise<void> {
  const conversation = await findConversation(params.clientId, params.leadId);
  await prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, params.leadId);
    await tx.conversationActivity.create({
      data: {
        conversationId: conversation.id,
        actorUserId: params.actorUserId,
        type: ConversationActivityType.REOPENED,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.NEEDS_REPLY, closedAt: null },
    });
    await tx.lead.update({
      where: { id: params.leadId },
      data: { status: "needs_reply" },
    });
  });
}

export async function closeConversation(params: {
  clientId: string;
  leadId: string;
  actorUserId: string;
}): Promise<void> {
  const conversation = await findConversation(params.clientId, params.leadId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await lockLeadForUpdate(tx, params.leadId);
    const currentConversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { inboundVersion: true },
    });
    await tx.conversationActivity.create({
      data: {
        conversationId: conversation.id,
        actorUserId: params.actorUserId,
        type: ConversationActivityType.CLOSED,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.CLOSED,
        responseVersion: currentConversation.inboundVersion,
        closedAt: now,
      },
    });
    await tx.leadResponse.updateMany({
      where: {
        leadId: params.leadId,
        status: { in: ["ready", "manual_review"] },
      },
      data: { status: "superseded" },
    });
    await tx.lead.update({
      where: { id: params.leadId },
      data: { status: "closed" },
    });
  });
}

async function findConversation(clientId: string, leadId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { clientId, leadId },
  });
  if (!conversation) {
    throw new AppNotFoundError("Pokalbis nerastas.");
  }
  return conversation;
}
