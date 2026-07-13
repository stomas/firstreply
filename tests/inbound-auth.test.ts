import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInboundSigningMasterSecret,
  deriveWebFormSecret,
  signWebFormPayload,
  verifyWebFormSignature,
  WEB_FORM_SIGNATURE_MAX_AGE_SECONDS,
} from "../lib/inbound/auth";

describe("web form inbound authentication", () => {
  const secret = deriveWebFormSecret({
    integrationId: "integration-1",
    secretVersion: 3,
    masterSecret: "a sufficiently long master secret for unit tests",
  });
  const rawBody = JSON.stringify({ message: "Reikia terasos" });
  const timestamp = "1783951200";
  const eventId = "event-1";

  it("derives stable, integration- and version-specific secrets", () => {
    assert.equal(
      secret,
      deriveWebFormSecret({
        integrationId: "integration-1",
        secretVersion: 3,
        masterSecret: "a sufficiently long master secret for unit tests",
      }),
    );
    assert.notEqual(
      secret,
      deriveWebFormSecret({
        integrationId: "integration-2",
        secretVersion: 3,
        masterSecret: "a sufficiently long master secret for unit tests",
      }),
    );
    assert.notEqual(
      secret,
      deriveWebFormSecret({
        integrationId: "integration-1",
        secretVersion: 4,
        masterSecret: "a sufficiently long master secret for unit tests",
      }),
    );
  });

  it("rejects a missing or weak master secret", () => {
    assert.throws(() => assertInboundSigningMasterSecret("short"), /32 bytes/);
  });

  it("accepts a signature over the exact timestamp, event ID and raw body", () => {
    const signature = signWebFormPayload({
      rawBody,
      timestamp,
      eventId,
      secret,
    });
    assert.deepEqual(
      verifyWebFormSignature({
        rawBody,
        timestamp,
        eventId,
        signature,
        secret,
        now: new Date(Number(timestamp) * 1000),
      }),
      { ok: true },
    );
  });

  it("rejects changed bodies, bad signatures and missing headers", () => {
    const signature = signWebFormPayload({
      rawBody,
      timestamp,
      eventId,
      secret,
    });
    assert.equal(
      verifyWebFormSignature({
        rawBody: `${rawBody} `,
        timestamp,
        eventId,
        signature,
        secret,
        now: new Date(Number(timestamp) * 1000),
      }).ok,
      false,
    );
    assert.deepEqual(
      verifyWebFormSignature({
        rawBody,
        timestamp,
        eventId,
        signature: "v1=bad",
        secret,
        now: new Date(Number(timestamp) * 1000),
      }),
      { ok: false, reason: "INVALID_SIGNATURE" },
    );
    assert.deepEqual(
      verifyWebFormSignature({
        rawBody,
        timestamp: null,
        eventId: null,
        signature: null,
        secret,
      }),
      { ok: false, reason: "MISSING_SIGNATURE_HEADERS" },
    );
  });

  it("binds the event ID into the signature so replay cannot rename it", () => {
    const signature = signWebFormPayload({
      rawBody,
      timestamp,
      eventId,
      secret,
    });
    assert.deepEqual(
      verifyWebFormSignature({
        rawBody,
        timestamp,
        eventId: "renamed-event",
        signature,
        secret,
        now: new Date(Number(timestamp) * 1000),
      }),
      { ok: false, reason: "INVALID_SIGNATURE" },
    );
  });

  it("rejects timestamps outside the five minute window", () => {
    const signature = signWebFormPayload({
      rawBody,
      timestamp,
      eventId,
      secret,
    });
    assert.deepEqual(
      verifyWebFormSignature({
        rawBody,
        timestamp,
        eventId,
        signature,
        secret,
        now: new Date(
          (Number(timestamp) + WEB_FORM_SIGNATURE_MAX_AGE_SECONDS + 1) * 1000,
        ),
      }),
      { ok: false, reason: "STALE_TIMESTAMP" },
    );
  });
});
