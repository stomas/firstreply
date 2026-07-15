import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GetReceivingEmailResponseSuccess } from "resend";
import { SourceIntegrationType } from "@prisma/client";
import {
  extractInquiryText,
  htmlToPlainText,
  isWebVersionPlaceholder,
  normalizePaslaugosLtEmail,
  stripForwardingBoilerplate,
} from "../lib/inbound/paslaugos-lt";
import {
  normalizeResendPaslaugosMessage,
  parseMailbox,
  parseReferences,
} from "../lib/inbound/resend-email";
import { realPaslaugosLtExcelAutomationFixture } from "./fixtures/paslaugos-lt/new-excel-automation";

describe("Paslaugos.lt inbound adapter", () => {
  it("uses plain text and strips common forwarding wrapper lines", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Nauja: Terasos įrengimas",
      from: "Paslaugos.lt <info@paslaugos.lt>",
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

  it("uses HTML when a real Paslaugos.lt plain-text alternative only links to the web version", () => {
    const fixture = realPaslaugosLtExcelAutomationFixture;
    const result = normalizePaslaugosLtEmail(fixture.input);

    assert.equal(result.recognized, true);
    assert.equal(result.text, fixture.expectedText);
    assert.equal(result.text.includes("Nematote turinio"), false);
    assert.equal(result.text.includes("Testinė įmonė"), false);
    assert.equal(result.text.includes("Turite klausimų"), false);
  });

  it("passes the real multipart fixture through the production Resend adapter", () => {
    const fixture = realPaslaugosLtExcelAutomationFixture;
    const message = normalizeResendPaslaugosMessage({
      object: "email",
      id: "fixture-email",
      to: ["p-fixture@in.firstreply.lt"],
      from: fixture.input.from,
      created_at: "2026-07-14T12:00:00.000Z",
      subject: fixture.input.subject,
      bcc: null,
      cc: null,
      reply_to: null,
      received_for: ["p-fixture@in.firstreply.lt"],
      html: fixture.input.html,
      text: fixture.input.text,
      headers: { ...fixture.input.headers },
      message_id: "<fixture@paslaugos.lt>",
      attachments: [],
    });

    assert.equal(message.text, fixture.expectedText);
    assert.equal(message.senderEmail, "uzklausos@paslaugos.lt");
    assert.equal(message.forcedManualReviewReason, undefined);
  });

  it("does not trust Paslaugos.lt branding supplied only in body fields", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Nauja: Terasos įrengimas",
      from: "Attacker <attacker@example.com>",
      headers: { From: "Attacker <attacker@example.com>" },
      text: "Paslaugos.lt\nReikia terasos Vilniuje.",
      html: null,
    });

    assert.equal(result.recognized, false);
    assert.equal(result.text, "Paslaugos.lt\nReikia terasos Vilniuje.");
  });

  it("parses the actual mailbox instead of trusting a deceptive display name", () => {
    for (const from of [
      '"Fake @paslaugos.lt" <attacker@example.com>',
      "alerts@paslaugos.lt, attacker@example.com",
      "Paslaugos.lt <alerts@paslaugos.lt>, attacker@example.com",
      "attacker@example.com, Paslaugos.lt <alerts@paslaugos.lt>",
    ]) {
      const result = normalizePaslaugosLtEmail({
        subject: "Nauja: Terasos įrengimas",
        from,
        headers: { From: from },
        text: [
          "---------- Forwarded message ---------",
          "From: Paslaugos.lt <info@paslaugos.lt>",
          "Reikia terasos Vilniuje.",
        ].join("\n"),
        html: null,
      });
      assert.equal(result.recognized, false);
    }

    const mismatched = normalizePaslaugosLtEmail({
      subject: "Nauja: Terasos įrengimas",
      from: "Paslaugos.lt <info@paslaugos.lt>",
      headers: { From: "Attacker <attacker@example.com>" },
      text: [
        "From: Paslaugos.lt <info@paslaugos.lt>",
        "Reikia terasos Vilniuje.",
      ].join("\n"),
      html: null,
    });
    assert.equal(mismatched.recognized, false);
  });

  it("does not accept unrelated mail genuinely sent from Paslaugos.lt", () => {
    const result = normalizePaslaugosLtEmail({
      subject: "Jūsų Paslaugos.lt sąskaita",
      from: "Paslaugos.lt <billing@paslaugos.lt>",
      headers: { From: "Paslaugos.lt <billing@paslaugos.lt>" },
      text: "Paslaugos.lt\nPrisegta mėnesio sąskaita.",
      html: null,
    });

    assert.equal(result.recognized, false);
  });

  it("keeps a broken web-version-only message in manual review", () => {
    const placeholder =
      "Nematote turinio? Žiūrėkite internete - https://paslaugos.lt/uzklausos/gautos/123";
    for (const html of [null, "<p>Nauja bendra užklausa Nr. 123</p>"]) {
      const result = normalizePaslaugosLtEmail({
        subject: "Nauja: Terasos įrengimas",
        from: "Paslaugos.lt <info@paslaugos.lt>",
        headers: { From: "Paslaugos.lt <info@paslaugos.lt>" },
        text: placeholder,
        html,
      });
      assert.equal(result.recognized, false);
      assert.equal(result.text, placeholder);
    }
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
    assert.equal(message.senderEmail, "uzklausos@paslaugos.lt");
    assert.equal(message.customerEmail, null);
    assert.equal(message.customerName, null);
    assert.equal(message.forcedManualReviewReason, undefined);
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
    fixture.from = "Billing <billing@example.com>";
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
    assert.equal(
      isWebVersionPlaceholder(
        "Nematote turinio? Žiūrėkite internete - https://paslaugos.lt/uzklausos/gautos/123",
      ),
      true,
    );
    assert.equal(
      extractInquiryText(
        "Antraštė\nExcel automatizacija\nReikia pagalbos.\nPeržiūrėti užklausą\nFooter",
        "Fwd: Nauja: Excel automatizacija",
      ),
      "Excel automatizacija\nReikia pagalbos.",
    );
  });
});

function receivedEmailFixture(): GetReceivingEmailResponseSuccess {
  return {
    object: "email",
    id: "email-1",
    to: ["p-source@in.firstreply.lt"],
    from: "Paslaugos.lt <uzklausos@paslaugos.lt>",
    created_at: "2026-07-13T12:00:00.000Z",
    subject: "Fwd: Nauja: Terasos įrengimas",
    bcc: null,
    cc: null,
    reply_to: null,
    received_for: ["p-source@in.firstreply.lt"],
    html: null,
    text: [
      "---------- Forwarded message ---------",
      "From: Paslaugos.lt <uzklausos@paslaugos.lt>",
      "Paslaugos.lt",
      "Reikia terasos Vilniuje.",
    ].join("\n"),
    headers: {
      From: "Paslaugos.lt <uzklausos@paslaugos.lt>",
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
