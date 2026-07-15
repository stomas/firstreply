import { createHmac, timingSafeEqual } from "node:crypto";
import { AppConfigError } from "@/lib/app-errors";

const WEBHOOK_MAX_AGE_SECONDS = 5 * 60;

export function deriveWebFormSecret(params: {
  integrationId: string;
  secretVersion: number;
  masterSecret?: string;
}): string {
  const masterSecret = assertInboundSigningMasterSecret(params.masterSecret);

  return createHmac("sha256", masterSecret)
    .update(`${params.integrationId}:${params.secretVersion}`)
    .digest("base64url");
}

export function assertInboundSigningMasterSecret(value?: string): string {
  const masterSecret =
    value?.trim() ?? process.env.INBOUND_SIGNING_MASTER_SECRET?.trim();
  if (!masterSecret) {
    throw new AppConfigError(
      "INBOUND_SIGNING_MASTER_SECRET is not configured.",
    );
  }
  if (Buffer.byteLength(masterSecret, "utf8") < 32) {
    throw new AppConfigError(
      "INBOUND_SIGNING_MASTER_SECRET must contain at least 32 bytes.",
    );
  }
  return masterSecret;
}

export function signWebFormPayload(params: {
  rawBody: string;
  timestamp: string;
  eventId: string;
  secret: string;
}): string {
  return `v1=${createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.eventId}.${params.rawBody}`)
    .digest("hex")}`;
}

export function verifyWebFormSignature(params: {
  rawBody: string;
  timestamp: string | null;
  eventId: string | null;
  signature: string | null;
  secret: string;
  now?: Date;
}): { ok: true } | { ok: false; reason: string } {
  if (!params.timestamp || !params.eventId || !params.signature) {
    return { ok: false, reason: "MISSING_SIGNATURE_HEADERS" };
  }

  const timestampSeconds = Number(params.timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    return { ok: false, reason: "INVALID_TIMESTAMP" };
  }

  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_MAX_AGE_SECONDS) {
    return { ok: false, reason: "STALE_TIMESTAMP" };
  }

  const expected = signWebFormPayload({
    rawBody: params.rawBody,
    timestamp: params.timestamp,
    eventId: params.eventId,
    secret: params.secret,
  });
  const receivedBuffer = Buffer.from(params.signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  return { ok: true };
}

export const WEB_FORM_SIGNATURE_MAX_AGE_SECONDS = WEBHOOK_MAX_AGE_SECONDS;
