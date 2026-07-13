export class InboundPayloadTooLargeError extends Error {
  constructor() {
    super("Inbound payload exceeds the configured size limit.");
    this.name = "InboundPayloadTooLargeError";
  }
}

export async function readInboundBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new InboundPayloadTooLargeError();
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new InboundPayloadTooLargeError();
  }
  return rawBody;
}

export const WEB_FORM_MAX_BODY_BYTES = 64 * 1024;
export const RESEND_WEBHOOK_MAX_BODY_BYTES = 2 * 1024 * 1024;
