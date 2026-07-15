import { SourceIntegrationType } from "@prisma/client";
import type { NormalizedInboundMessage } from "@/lib/inbound/types";
import type { WebFormInboundPayload } from "@/lib/inbound/web-form-schema";

export function normalizeWebFormMessage(params: {
  eventId: string;
  payload: WebFormInboundPayload;
  receivedAt?: Date;
}): NormalizedInboundMessage {
  return {
    provider: "web_form",
    providerMessageId: params.eventId,
    internetMessageId: null,
    inReplyTo: null,
    references: [],
    receivedAt: params.payload.submittedAt
      ? new Date(params.payload.submittedAt)
      : (params.receivedAt ?? new Date()),
    subject: "Svetainės formos užklausa",
    text: params.payload.message,
    senderEmail: params.payload.email ?? null,
    senderName: params.payload.name ?? null,
    recipients: [],
    cc: [],
    customerName: params.payload.name ?? null,
    customerEmail: params.payload.email ?? null,
    customerPhone: params.payload.phone ?? null,
    city: params.payload.city ?? null,
    attachments: [],
    sourceType: SourceIntegrationType.WEB_FORM,
    threadReferencesTrusted: true,
  };
}
