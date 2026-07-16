import assert from "node:assert/strict";
import test from "node:test";
import {
  OutboundDispatchStatus,
  OutboundIntegrationStatus,
  type Prisma,
  SourceIntegrationType,
} from "@prisma/client";
import { AppValidationError } from "@/lib/app-errors";
import { clientSafeOutboundText } from "@/lib/outbound/client-copy";
import {
  assertOutboundSource,
  classifyDispatchRetry,
  defaultReplySubject,
  formatSender,
  isUncertainProviderError,
  mapResendDomainStatus,
  parseOutboundIntegrationInput,
  parseOutboundSendInput,
  plainTextToSafeHtml,
  shouldTriggerDomainVerification,
} from "@/lib/outbound/helpers";
import { assertNoUnfinishedOutboundDispatch } from "@/lib/outbound/guards";

test("normalizes a company sender and derives its exact domain", () => {
  assert.deepEqual(
    parseOutboundIntegrationInput({
      name: "  Pagrindinis  ",
      fromName: " UAB Pavyzdys ",
      fromEmail: "LABAS@MAIL.PAVYZDYS.LT",
      replyToEmail: "INFO@PAVYZDYS.LT",
    }),
    {
      name: "Pagrindinis",
      fromName: "UAB Pavyzdys",
      fromEmail: "labas@mail.pavyzdys.lt",
      replyToEmail: "info@pavyzdys.lt",
      domain: "mail.pavyzdys.lt",
    },
  );
});

test("rejects consumer domains and header injection", () => {
  assert.throws(
    () =>
      parseOutboundIntegrationInput({
        name: "X",
        fromName: "Blogas\nBcc: attacker@example.com",
        fromEmail: "x@gmail.com",
        replyToEmail: "x@gmail.com",
      }),
    AppValidationError,
  );
  assert.throws(
    () =>
      parseOutboundSendInput({
        leadId: "lead",
        responseRevisionId: "response",
        sendRequestId: "d5ff5539-d650-463a-82ca-b72516f77e5e",
        subject: "Tema\r\nBcc: attacker@example.com",
        text: "Tekstas",
      }),
    AppValidationError,
  );
});

test("maps only a fully verified Resend domain to active", () => {
  assert.equal(
    mapResendDomainStatus("verified"),
    OutboundIntegrationStatus.ACTIVE,
  );
  assert.equal(
    mapResendDomainStatus("pending"),
    OutboundIntegrationStatus.PENDING_VERIFICATION,
  );
  assert.equal(
    mapResendDomainStatus("partially_verified"),
    OutboundIntegrationStatus.PENDING_VERIFICATION,
  );
  assert.equal(
    mapResendDomainStatus("failed"),
    OutboundIntegrationStatus.FAILED,
  );
});

test("starts domain verification only for initial or failed states", () => {
  assert.equal(shouldTriggerDomainVerification("not_started"), true);
  assert.equal(shouldTriggerDomainVerification("failed"), true);
  assert.equal(shouldTriggerDomainVerification("partially_failed"), true);
  assert.equal(shouldTriggerDomainVerification("pending"), false);
  assert.equal(shouldTriggerDomainVerification("partially_verified"), false);
  assert.equal(shouldTriggerDomainVerification("verified"), false);
});

test("removes the infrastructure provider name from stored client copy", () => {
  assert.equal(
    clientSafeOutboundText("Resend nepristatė laiško."),
    "El. pašto siuntimo paslaugos klaida.",
  );
  assert.equal(
    clientSafeOutboundText("Klaida iš resend sistemos."),
    "El. pašto siuntimo paslaugos klaida.",
  );
  assert.equal(
    clientSafeOutboundText("Gavėjo adresas neegzistuoja."),
    "Gavėjo adresas neegzistuoja.",
  );
});

test("escapes edited plain text before generating HTML", () => {
  assert.equal(
    plainTextToSafeHtml("Sveiki <script>\n& iki\n\nAčiū"),
    "<p>Sveiki &lt;script&gt;<br>&amp; iki</p><p>Ačiū</p>",
  );
  assert.equal(
    formatSender('UAB "Pavyzdys"', "labas@example.lt"),
    '"UAB \\"Pavyzdys\\"" <labas@example.lt>',
  );
});

test("direct sending is source-specific and blocks Paslaugos.lt", () => {
  assert.doesNotThrow(() =>
    assertOutboundSource(SourceIntegrationType.WEB_FORM),
  );
  assert.throws(
    () => assertOutboundSource(SourceIntegrationType.PASLAUGOS_LT),
    AppValidationError,
  );
});

test("classifies duplicate, concurrent, stale and expired retries", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");
  const recent = new Date("2026-07-14T11:55:00.000Z");
  const stale = new Date("2026-07-14T11:40:00.000Z");
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.SENT,
      createdAt: recent,
      processingStartedAt: recent,
      now,
    }),
    "already_sent",
  );
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.SENDING,
      createdAt: recent,
      processingStartedAt: recent,
      now,
    }),
    "in_progress",
  );
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.SENDING,
      createdAt: stale,
      processingStartedAt: stale,
      now,
    }),
    "retry",
  );
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.FAILED,
      createdAt: recent,
      processingStartedAt: recent,
      now,
    }),
    "retry",
  );
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.UNKNOWN,
      createdAt: recent,
      processingStartedAt: recent,
      now,
    }),
    "blocked",
  );
  assert.equal(
    classifyDispatchRetry({
      status: OutboundDispatchStatus.FAILED,
      createdAt: new Date("2026-07-13T12:00:00.000Z"),
      processingStartedAt: recent,
      now,
    }),
    "expired",
  );
});

test("reply subject preserves existing Re prefix and applies limits", () => {
  assert.equal(defaultReplySubject(null), "Atsakymas į jūsų užklausą");
  assert.equal(defaultReplySubject("Re: Langai"), "Re: Langai");
  assert.equal(defaultReplySubject("Langai"), "Re: Langai");
  assert.equal(defaultReplySubject("x".repeat(400)).length, 300);
});

test("treats ambiguous Resend responses as transport-uncertain", () => {
  assert.equal(
    isUncertainProviderError({
      name: "concurrent_idempotent_requests",
      statusCode: 409,
    }),
    true,
  );
  assert.equal(
    isUncertainProviderError({
      name: "internal_server_error",
      statusCode: 500,
    }),
    true,
  );
  assert.equal(
    isUncertainProviderError({
      name: "invalid_idempotent_request",
      statusCode: 409,
    }),
    true,
  );
  assert.equal(
    isUncertainProviderError({ name: "validation_error", statusCode: 422 }),
    false,
  );
});

test("manual conversation transitions reject unfinished outbound dispatches", async () => {
  let capturedWhere: unknown;
  const tx = {
    outboundDispatch: {
      findFirst: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return { id: "dispatch-1" };
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    () => assertNoUnfinishedOutboundDispatch(tx, "conversation-1"),
    (error: unknown) => {
      assert.ok(error instanceof AppValidationError);
      assert.doesNotMatch(error.message, /resend/iu);
      return true;
    },
  );
  assert.deepEqual(capturedWhere, {
    conversationId: "conversation-1",
    OR: [
      {
        status: {
          in: [OutboundDispatchStatus.SENDING, OutboundDispatchStatus.UNKNOWN],
        },
      },
      {
        status: OutboundDispatchStatus.FAILED,
        errorCode: "TRANSPORT_UNCERTAIN",
      },
    ],
  });
});

test("manual conversation transitions proceed without unfinished dispatches", async () => {
  const tx = {
    outboundDispatch: { findFirst: async () => null },
  } as unknown as Prisma.TransactionClient;
  await assert.doesNotReject(() =>
    assertNoUnfinishedOutboundDispatch(tx, "conversation-1"),
  );
});
