import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  deriveWebFormSecret,
  verifyWebFormSignature,
} from "@/lib/inbound/auth";
import { claimInboundEvent, failInboundEvent } from "@/lib/inbound/events";
import { ingestInboundMessage } from "@/lib/inbound/ingest";
import {
  InboundPayloadTooLargeError,
  readInboundBody,
  WEB_FORM_MAX_BODY_BYTES,
} from "@/lib/inbound/request-body";
import { webFormIntegrationWhere } from "@/lib/inbound/routing";
import { normalizeWebFormMessage } from "@/lib/inbound/web-form-message";
import { webFormInboundSchema } from "@/lib/inbound/web-form-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ integrationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { integrationId } = await context.params;
  const integration = await prisma.sourceIntegration.findFirst({
    where: webFormIntegrationWhere(integrationId),
  });
  if (!integration) {
    return NextResponse.json(
      { ok: false, error: "Integration not found." },
      { status: 404 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await readInboundBody(request, WEB_FORM_MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof InboundPayloadTooLargeError) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }
    throw error;
  }
  let secret: string;
  try {
    secret = deriveWebFormSecret({
      integrationId: integration.id,
      secretVersion: integration.secretVersion,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INBOUND_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  const externalEventId = request.headers.get("x-firstreply-event-id")?.trim();
  if (!externalEventId || externalEventId.length > 200) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EVENT_ID" },
      { status: 400 },
    );
  }
  const signature = verifyWebFormSignature({
    rawBody,
    timestamp: request.headers.get("x-firstreply-timestamp"),
    eventId: externalEventId,
    signature: request.headers.get("x-firstreply-signature"),
    secret,
  });
  if (!signature.ok) {
    return NextResponse.json(
      { ok: false, error: signature.reason },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400 },
    );
  }
  const parsed = webFormInboundSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD" },
      { status: 422 },
    );
  }

  const claim = await claimInboundEvent({
    sourceIntegrationId: integration.id,
    externalEventId,
    provider: "web_form",
    metadata: {
      pageUrl: parsed.data.pageUrl ?? null,
      submittedAt: parsed.data.submittedAt ?? null,
    },
  });
  if (claim.status !== "claimed") {
    if (claim.status === "processing") {
      return NextResponse.json(
        { ok: false, status: "processing", eventId: claim.eventId },
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    return NextResponse.json(
      { ok: true, status: claim.status, eventId: claim.eventId },
      { status: 200 },
    );
  }

  try {
    const result = await ingestInboundMessage({
      integrationId: integration.id,
      eventId: claim.eventId,
      eventLeaseToken: claim.leaseToken,
      message: normalizeWebFormMessage({
        eventId: externalEventId,
        payload: parsed.data,
      }),
    });
    return NextResponse.json({ ok: true, status: "completed", ...result });
  } catch (error) {
    await failInboundEvent(claim.eventId, claim.leaseToken, error);
    console.error("[web-form-inbound] processing failed", {
      eventId: claim.eventId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "INBOUND_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "Use POST." }, { status: 405 });
}
