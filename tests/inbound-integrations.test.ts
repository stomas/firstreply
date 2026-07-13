import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConversationStatus,
  SourceIntegrationStatus,
  SourceIntegrationTransport,
  SourceIntegrationType,
} from "@prisma/client";
import { assertCanMarkAnsweredExternally } from "../lib/inbound/conversations";
import {
  generatePaslaugosRoutingAddress,
  normalizeIntegrationName,
} from "../lib/inbound/integrations";
import {
  conversationResponseVersionWhere,
  hasUntrustedThreadReferences,
  normalizeMessageId,
  normalizeThreadIds,
} from "../lib/inbound/ingest";
import {
  normalizeResendRecipients,
  paslaugosIntegrationWhere,
  webFormIntegrationWhere,
} from "../lib/inbound/routing";

describe("source-specific integration helpers", () => {
  it("creates deterministic source-specific routing addresses", () => {
    assert.equal(
      generatePaslaugosRoutingAddress({
        domain: "IN.FirstReply.LT",
        randomToken: "abc123",
      }),
      "p-abc123@in.firstreply.lt",
    );
  });

  it("normalizes names without imposing an integration count limit", () => {
    assert.equal(normalizeIntegrationName("  Forma A  ", "Forma"), "Forma A");
    assert.equal(normalizeIntegrationName("", "Forma"), "Forma");
    assert.equal(
      normalizeIntegrationName("x".repeat(150), "Forma").length,
      120,
    );
  });

  it("threads only explicit message identifiers and never subjects", () => {
    assert.equal(
      normalizeMessageId("  <one@example.com> "),
      "<one@example.com>",
    );
    assert.deepEqual(
      normalizeThreadIds([
        null,
        "<one@example.com>",
        " <two@example.com> ",
        "<one@example.com>",
      ]),
      ["<one@example.com>", "<two@example.com>"],
    );
  });

  it("does not trust Resend-style declarative thread headers", () => {
    assert.equal(
      hasUntrustedThreadReferences({
        inReplyTo: "<known@example.com>",
        references: [],
        threadReferencesTrusted: false,
      }),
      true,
    );
    assert.equal(
      hasUntrustedThreadReferences({
        inReplyTo: null,
        references: ["<known@example.com>"],
        threadReferencesTrusted: true,
      }),
      false,
    );
  });

  it("commits a draft only for the exact latest conversation generation", () => {
    assert.deepEqual(conversationResponseVersionWhere("conversation-1", 4), {
      id: "conversation-1",
      inboundVersion: 4,
      responseVersion: { lt: 4 },
    });
  });

  it("requires reopening a closed conversation before an external answer", () => {
    assert.throws(
      () => assertCanMarkAnsweredExternally(ConversationStatus.CLOSED),
      /atidarykite pokalbį iš naujo/,
    );
    assert.doesNotThrow(() =>
      assertCanMarkAnsweredExternally(ConversationStatus.NEEDS_REPLY),
    );
  });

  it("routes web forms by an active integration with a fixed source and transport", () => {
    assert.deepEqual(webFormIntegrationWhere("integration-1"), {
      id: "integration-1",
      sourceType: SourceIntegrationType.WEB_FORM,
      transport: SourceIntegrationTransport.HTTP_WEBHOOK,
      status: SourceIntegrationStatus.ACTIVE,
    });
  });

  it("routes Resend only by exact normalized Paslaugos recipients", () => {
    const recipients = normalizeResendRecipients({
      to: [" P-A@IN.FIRSTREPLY.LT "],
      receivedFor: ["p-a@in.firstreply.lt", "p-b@in.firstreply.lt"],
    });
    assert.deepEqual(recipients, [
      "p-a@in.firstreply.lt",
      "p-b@in.firstreply.lt",
    ]);
    assert.deepEqual(paslaugosIntegrationWhere(recipients), {
      routingAddress: { in: recipients },
      sourceType: SourceIntegrationType.PASLAUGOS_LT,
      transport: SourceIntegrationTransport.RESEND_EMAIL,
      status: SourceIntegrationStatus.ACTIVE,
    });
  });
});
