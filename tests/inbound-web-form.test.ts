import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SourceIntegrationType } from "@prisma/client";
import {
  InboundPayloadTooLargeError,
  readInboundBody,
} from "../lib/inbound/request-body";
import { normalizeWebFormMessage } from "../lib/inbound/web-form-message";
import { webFormInboundSchema } from "../lib/inbound/web-form-schema";

describe("web form inbound contract", () => {
  it("accepts the structured payload and normalizes a fixed source", () => {
    const parsed = webFormInboundSchema.parse({
      name: "Jonas",
      email: "jonas@example.com",
      phone: "+37060000000",
      city: "Vilnius",
      message: "Reikia terasos",
      pageUrl: "https://example.com/kontaktai",
      submittedAt: "2026-07-13T12:00:00.000Z",
      sourceType: "PASLAUGOS_LT",
    });
    const message = normalizeWebFormMessage({
      eventId: "form-event-1",
      payload: parsed,
    });

    assert.equal(message.providerMessageId, "form-event-1");
    assert.equal(message.sourceType, SourceIntegrationType.WEB_FORM);
    assert.equal(message.threadReferencesTrusted, true);
    assert.equal(message.customerEmail, "jonas@example.com");
    assert.equal(message.receivedAt.toISOString(), parsed.submittedAt);
  });

  it("rejects malformed or overlong structured data", () => {
    assert.equal(
      webFormInboundSchema.safeParse({ message: "", email: "bad" }).success,
      false,
    );
    assert.equal(
      webFormInboundSchema.safeParse({ message: "x".repeat(20_001) }).success,
      false,
    );
  });

  it("enforces the raw request size limit with and without content-length", async () => {
    await assert.rejects(
      readInboundBody(
        new Request("https://firstreply.test", {
          method: "POST",
          headers: { "content-length": "101" },
          body: "small",
        }),
        100,
      ),
      InboundPayloadTooLargeError,
    );
    await assert.rejects(
      readInboundBody(
        new Request("https://firstreply.test", {
          method: "POST",
          body: "ą".repeat(60),
        }),
        100,
      ),
      InboundPayloadTooLargeError,
    );
  });
});
