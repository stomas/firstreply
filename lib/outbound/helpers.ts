import {
  OutboundDispatchStatus,
  OutboundIntegrationStatus,
  SourceIntegrationType,
} from "@prisma/client";
import { z } from "zod";
import { AppValidationError } from "@/lib/app-errors";

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

const integrationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fromName: z.string().trim().min(1).max(120),
  fromEmail: email,
  replyToEmail: email,
});

const sendSchema = z.object({
  leadId: z.string().trim().min(1).max(200),
  responseRevisionId: z.string().trim().min(1).max(200),
  sendRequestId: z.string().trim().uuid(),
  subject: z.string().trim().min(1).max(300),
  text: z.string().trim().min(1).max(20_000),
});

export type OutboundIntegrationInput = z.infer<typeof integrationSchema> & {
  domain: string;
};

export type OutboundSendInput = z.infer<typeof sendSchema>;

export function parseOutboundIntegrationInput(
  input: unknown,
): OutboundIntegrationInput {
  const parsed = integrationSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppValidationError(
      "Patikrinkite siuntėjo pavadinimą ir el. pašto adresus.",
    );
  }
  assertHeaderSafe(parsed.data.fromName);
  const domain = parsed.data.fromEmail.split("@")[1];
  if (
    !domain ||
    domain === "gmail.com" ||
    domain === "outlook.com" ||
    domain === "yahoo.com"
  ) {
    throw new AppValidationError("Naudokite įmonės valdomą siuntimo domeną.");
  }
  return { ...parsed.data, domain };
}

export function parseOutboundSendInput(input: unknown): OutboundSendInput {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppValidationError("Patikrinkite laiško temą ir tekstą.");
  }
  assertHeaderSafe(parsed.data.subject);
  return parsed.data;
}

export function mapResendDomainStatus(
  status: string,
): OutboundIntegrationStatus {
  if (status === "verified") return OutboundIntegrationStatus.ACTIVE;
  if (status === "failed" || status === "partially_failed") {
    return OutboundIntegrationStatus.FAILED;
  }
  return OutboundIntegrationStatus.PENDING_VERIFICATION;
}

export function shouldTriggerDomainVerification(status: string): boolean {
  return ["not_started", "failed", "partially_failed"].includes(status);
}

export function plainTextToSafeHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function formatSender(name: string, address: string): string {
  assertHeaderSafe(name);
  if (!email.safeParse(address).success) {
    throw new AppValidationError("Netinkamas siuntėjo el. pašto adresas.");
  }
  const escaped = name.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}" <${address}>`;
}

export function assertOutboundSource(sourceType: SourceIntegrationType): void {
  if (sourceType !== SourceIntegrationType.WEB_FORM) {
    throw new AppValidationError(
      "Šiam šaltiniui tiesioginis atsakymas dar nepalaikomas. Pažymėkite „Atsakyta kitur“.",
    );
  }
}

export function defaultReplySubject(subject: string | null): string {
  const clean = subject?.trim();
  if (!clean) return "Atsakymas į jūsų užklausą";
  return /^re:/i.test(clean)
    ? clean.slice(0, 300)
    : `Re: ${clean}`.slice(0, 300);
}

export type DispatchRetryDecision =
  | "already_sent"
  | "in_progress"
  | "retry"
  | "expired"
  | "blocked";

export function classifyDispatchRetry(params: {
  status: OutboundDispatchStatus;
  createdAt: Date;
  processingStartedAt: Date;
  now: Date;
}): DispatchRetryDecision {
  if (
    params.status === OutboundDispatchStatus.SENT ||
    params.status === OutboundDispatchStatus.DELIVERED
  ) {
    return "already_sent";
  }
  if (params.now.getTime() - params.createdAt.getTime() > 23 * 60 * 60 * 1000) {
    return "expired";
  }
  if (params.status === OutboundDispatchStatus.SENDING) {
    return params.now.getTime() - params.processingStartedAt.getTime() <
      10 * 60 * 1000
      ? "in_progress"
      : "retry";
  }
  if (params.status === OutboundDispatchStatus.FAILED) return "retry";
  return "blocked";
}

export function isUncertainProviderError(params: {
  name: string;
  statusCode: number | null;
}): boolean {
  if (params.statusCode === null || params.statusCode >= 500) return true;
  return [
    "concurrent_idempotent_requests",
    "invalid_idempotent_request",
    "application_error",
    "internal_server_error",
  ].includes(params.name);
}

function assertHeaderSafe(value: string): void {
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new AppValidationError(
      "Laiško antraštėse negali būti valdymo simbolių.",
    );
  }
}
