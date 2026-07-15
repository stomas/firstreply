import { SourceIntegrationType } from "@prisma/client";
import type { GetReceivingEmailResponseSuccess } from "resend";
import { normalizePaslaugosLtEmail } from "@/lib/inbound/paslaugos-lt";
import type { NormalizedInboundMessage } from "@/lib/inbound/types";

const MAX_REFERENCES = 100;

export function normalizeResendPaslaugosMessage(
  email: GetReceivingEmailResponseSuccess,
): NormalizedInboundMessage {
  const normalized = normalizePaslaugosLtEmail({
    subject: email.subject,
    text: email.text,
    html: email.html,
    from: email.from,
    headers: email.headers,
  });
  const displaySender = parseMailbox(
    findHeader(email.headers, "from") ?? email.from,
  );

  return {
    provider: "resend",
    providerMessageId: email.id,
    internetMessageId: email.message_id || null,
    inReplyTo: findHeader(email.headers, "in-reply-to"),
    references: parseReferences(findHeader(email.headers, "references")),
    receivedAt: new Date(email.created_at),
    subject: email.subject || null,
    text: normalized.text,
    senderEmail: displaySender.email,
    senderName: displaySender.name,
    recipients: email.to,
    cc: email.cc ?? [],
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    city: null,
    attachments: email.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename ?? "attachment",
      contentType: attachment.content_type,
      contentDisposition: attachment.content_disposition,
    })),
    sourceType: SourceIntegrationType.PASLAUGOS_LT,
    // Resend exposes the parsed From and message headers, but not an
    // authenticated SMTP envelope identity. Preserve thread headers for audit,
    // while preventing them from joining an existing conversation.
    threadReferencesTrusted: false,
    ...(normalized.recognized
      ? {}
      : { forcedManualReviewReason: "SOURCE_FORMAT_UNRECOGNIZED" }),
  };
}

export function findHeader(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value.trim() || null;
    }
  }
  return null;
}

export function parseReferences(value: string | null): string[] {
  if (!value) {
    return [];
  }
  const bracketed = value.match(/<[^>]+>/g);
  const values = bracketed ?? value.split(/\s+/);
  return Array.from(
    new Set(values.map((item) => item.trim()).filter(Boolean)),
  ).slice(0, MAX_REFERENCES);
}

export function parseMailbox(value: string): {
  email: string | null;
  name: string | null;
} {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: normalizeEmail(match[2]),
    };
  }
  return { email: normalizeEmail(value), name: null };
}

function normalizeEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
}
