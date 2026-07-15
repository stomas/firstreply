import type { SourceIntegrationType } from "@prisma/client";

export type InboundAttachment = {
  id?: string;
  filename: string;
  contentType: string | null;
  contentDisposition?: string | null;
};

export type NormalizedInboundMessage = {
  provider: "web_form" | "resend";
  providerMessageId: string;
  internetMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  receivedAt: Date;
  subject: string | null;
  text: string;
  senderEmail: string | null;
  senderName: string | null;
  recipients: string[];
  cc: string[];
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  city: string | null;
  attachments: InboundAttachment[];
  sourceType: SourceIntegrationType;
  threadReferencesTrusted: boolean;
  forcedManualReviewReason?: string;
};

export type InboundIngestResult = {
  eventId: string;
  messageId: string | null;
  conversationId: string | null;
  leadId: string | null;
  status: "completed" | "duplicate" | "processing" | "rejected";
};
