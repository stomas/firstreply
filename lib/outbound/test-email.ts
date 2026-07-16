import { OutboundIntegrationStatus } from "@prisma/client";
import { Resend } from "resend";
import { z } from "zod";
import { AppConfigError, AppValidationError } from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import { formatSender, plainTextToSafeHtml } from "@/lib/outbound/helpers";

const testEmailSchema = z.object({
  recipient: z.string().trim().email().max(320),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((value) => !/[\r\n]/u.test(value)),
  text: z.string().trim().min(1).max(20_000),
  requestId: z.string().trim().uuid(),
});

export type TestEmailInput = z.infer<typeof testEmailSchema>;

export type TestEmailSender = {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
};

export async function getTestEmailSender(
  clientId: string,
): Promise<TestEmailSender | null> {
  assertDatabaseConfigured();
  return prisma.outboundIntegration.findFirst({
    where: {
      clientId,
      isDefault: true,
      status: OutboundIntegrationStatus.ACTIVE,
      providerStatus: "verified",
    },
    orderBy: { createdAt: "asc" },
    select: { fromName: true, fromEmail: true, replyToEmail: true },
  });
}

export function parseTestEmailInput(input: unknown): TestEmailInput {
  const parsed = testEmailSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppValidationError(
      "Patikrinkite gavėjo adresą, laiško temą ir tekstą.",
    );
  }
  return parsed.data;
}

export function buildTestEmailIdempotencyKey(
  clientId: string,
  requestId: string,
): string {
  return `fr-test/${clientId}/${requestId}`;
}

export function buildTestEmailPayload(
  sender: TestEmailSender,
  input: TestEmailInput,
) {
  return {
    from: formatSender(sender.fromName, sender.fromEmail),
    to: input.recipient,
    replyTo: sender.replyToEmail,
    subject: input.subject,
    text: input.text,
    html: plainTextToSafeHtml(input.text),
  };
}

export async function sendTestEmail(params: {
  clientId: string;
  recipient: string;
  subject: string;
  text: string;
  requestId: string;
}): Promise<{ messageId: string }> {
  assertDatabaseConfigured();
  if (process.env.EMAIL_SENDING_ENABLED !== "true") {
    throw new AppConfigError(
      "El. laiškų siuntimas globaliai išjungtas. Railway nustatykite EMAIL_SENDING_ENABLED=true ir redeployinkite.",
    );
  }

  const input = parseTestEmailInput(params);
  const sender = await getTestEmailSender(params.clientId);
  if (!sender) {
    throw new AppValidationError(
      "Nėra aktyvaus, patvirtinto numatytojo siuntėjo.",
    );
  }

  const emailClient = getEmailClient();
  let response: Awaited<ReturnType<typeof emailClient.emails.send>>;
  try {
    response = await emailClient.emails.send(
      buildTestEmailPayload(sender, input),
      {
        idempotencyKey: buildTestEmailIdempotencyKey(
          params.clientId,
          input.requestId,
        ),
      },
    );
  } catch (error) {
    console.error("[test-email-send] provider request failed", error);
    throw new AppValidationError(
      "Siuntimo rezultatas neaiškus. Nekeičiant laukų galima saugiai bandyti dar kartą.",
    );
  }

  if (response.error || !response.data) {
    console.error("[test-email-send] provider rejected request", {
      error: response.error,
    });
    throw new AppValidationError(
      "El. pašto siuntimo paslauga laiško nepriėmė. Patikrinkite gavėją ir siuntėjo konfigūraciją.",
    );
  }

  return { messageId: response.data.id };
}

function getEmailClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new AppConfigError("El. pašto siuntimo paslauga nesukonfigūruota.");
  }
  return new Resend(key);
}
