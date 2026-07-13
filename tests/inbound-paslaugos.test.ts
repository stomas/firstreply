import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GetReceivingEmailResponseSuccess } from "resend";
import { SourceIntegrationType } from "@prisma/client";
import {
  htmlToPlainText,
  normalizePaslaugosLtEmail,
  stripForwardingBoilerplate,
} from "../lib/inbound/paslaugos-lt";
import {
  normalizeResendPaslaugosMessage,
  parseMailbox,
  parseReferences,
} from "../lib/inbound/resend-email";

describe("Paslaugos.lt inbound adapter", () => {
  it("uses plain text and strips common forwarding wrapper lines", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Nauja užklausa iš Paslaugos.lt",
      from: "Klientas <owner@example.com>",
      text: [
        "---------- Forwarded message ---------",
        "From: Paslaugos.lt <info@paslaugos.lt>",
        "Subject: Nauja užklausa",
        "Reikia 20 m² terasos Vilniuje.",
      ].join("\n"),
      html: null,
    });

    assert.equal(result.recognized, true);
    assert.equal(result.text, "Reikia 20 m² terasos Vilniuje.");
  });

  it("falls back from HTML to clean text", () => {
    assert.equal(
      htmlToPlainText(
        '<div><strong>Paslaugos.lt</strong></div><p>Reikia <a href="https://example.com">terasos</a>.</p><img src="x">',
      ),
      "Paslaugos.lt\n\nReikia terasos.",
    );
  });

  it("does not classify an unrelated message as another source", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Sąskaita",
      from: "billing@example.com",
      text: "Prisegta mėnesio sąskaita.",
      html: null,
    });
    assert.equal(result.recognized, false);
    assert.equal(result.text, "Prisegta mėnesio sąskaita.");
  });

  it("sends a Paslaugos-branded but empty message to manual review", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Paslaugos.lt užklausa",
      from: "info@paslaugos.lt",
      text: "",
      html: null,
    });
    assert.equal(result.recognized, false);
    assert.equal(result.text, "");
  });

  it("normalizes headers and keeps transport sender separate from customer data", () => {
    const message = normalizeResendPaslaugosMessage(receivedEmailFixture());
    assert.equal(message.sourceType, SourceIntegrationType.PASLAUGOS_LT);
    assert.equal(message.senderEmail, "owner@example.com");
    assert.equal(message.customerEmail, null);
    assert.equal(message.customerName, null);
    assert.equal(message.threadReferencesTrusted, false);
    assert.equal(message.inReplyTo, "<parent@example.com>");
    assert.deepEqual(message.references, [
      "<root@example.com>",
      "<parent@example.com>",
    ]);
    assert.equal(message.attachments.length, 1);
  });

  it("forces manual review for an unrecognized payload at a Paslaugos route", () => {
    const fixture = receivedEmailFixture();
    fixture.subject = "Unrelated notification";
    fixture.text = "This is not from the configured source.";
    fixture.headers = { From: "billing@example.com" };
    const message = normalizeResendPaslaugosMessage(fixture);

    assert.equal(message.sourceType, SourceIntegrationType.PASLAUGOS_LT);
    assert.equal(
      message.forcedManualReviewReason,
      "SOURCE_FORMAT_UNRECOGNIZED",
    );
  });

  it("parses mailboxes and deduplicates references", () => {
    assert.deepEqual(parseMailbox('"Jonas Jonaitis" <Jonas@Example.com>'), {
      email: "jonas@example.com",
      name: "Jonas Jonaitis",
    });
    assert.deepEqual(
      parseReferences("<one@example.com> <two@example.com> <one@example.com>"),
      ["<one@example.com>", "<two@example.com>"],
    );
    assert.equal(stripForwardingBoilerplate("Tema: X\n\nTurinys"), "Turinys");
  });
});

function receivedEmailFixture(): GetReceivingEmailResponseSuccess {
  return {
    object: "email",
    id: "email-1",
    to: ["p-source@in.firstreply.lt"],
    from: "Owner <owner@example.com>",
    created_at: "2026-07-13T12:00:00.000Z",
    subject: "Fwd: Paslaugos.lt užklausa",
    bcc: null,
    cc: null,
    reply_to: ["owner@example.com"],
    received_for: ["p-source@in.firstreply.lt"],
    html: null,
    text: "Paslaugos.lt\nReikia terasos Vilniuje.",
    headers: {
      From: "Owner <owner@example.com>",
      "In-Reply-To": "<parent@example.com>",
      References: "<root@example.com> <parent@example.com> <root@example.com>",
    },
    message_id: "<message@example.com>",
    attachments: [
      {
        id: "attachment-1",
        filename: "planas.pdf",
        size: 123,
        content_type: "application/pdf",
        content_id: null,
        content_disposition: "attachment",
      },
    ],
  };
}
