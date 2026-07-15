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

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new InboundPayloadTooLargeError();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

export const WEB_FORM_MAX_BODY_BYTES = 64 * 1024;
export const RESEND_WEBHOOK_MAX_BODY_BYTES = 2 * 1024 * 1024;
