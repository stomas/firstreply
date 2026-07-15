import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { claimInboundEvent, failInboundEvent } from "@/lib/inbound/events";
import { ingestInboundMessage } from "@/lib/inbound/ingest";
import {
  InboundPayloadTooLargeError,
  readInboundBody,
  RESEND_WEBHOOK_MAX_BODY_BYTES,
} from "@/lib/inbound/request-body";
import { normalizeResendPaslaugosMessage } from "@/lib/inbound/resend-email";
import {
  normalizeResendRecipients,
  paslaugosIntegrationWhere,
} from "@/lib/inbound/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!apiKey || !webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "RESEND_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await readInboundBody(request, RESEND_WEBHOOK_MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof InboundPayloadTooLargeError) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }
    throw error;
  }
  const resend = new Resend(apiKey);
  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_WEBHOOK_SIGNATURE" },
      { status: 401 },
    );
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, status: "ignored_event_type" });
  }

  const recipients = normalizeResendRecipients({
    to: event.data.to,
    receivedFor: event.data.received_for,
  });
  const integrations = await prisma.sourceIntegration.findMany({
    where: paslaugosIntegrationWhere(recipients),
    take: 2,
  });
  if (integrations.length !== 1) {
    return NextResponse.json({
      ok: true,
      status:
        integrations.length === 0
          ? "ignored_recipient"
          : "ignored_ambiguous_recipient",
    });
  }
  const integration = integrations[0];

  const claim = await claimInboundEvent({
    sourceIntegrationId: integration.id,
    externalEventId: event.data.email_id,
    provider: "resend",
    metadata: {
      emailId: event.data.email_id,
      routingAddress: integration.routingAddress,
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
    const received = await resend.emails.receiving.get(event.data.email_id, {
      html_format: "cid",
    });
    if (received.error || !received.data) {
      throw new Error(
        received.error?.message ?? "Resend did not return the received email.",
      );
    }
    const result = await ingestInboundMessage({
      integrationId: integration.id,
      eventId: claim.eventId,
      eventLeaseToken: claim.leaseToken,
      message: normalizeResendPaslaugosMessage(received.data),
    });
    return NextResponse.json({ ok: true, status: "completed", ...result });
  } catch (error) {
    await failInboundEvent(claim.eventId, claim.leaseToken, error);
    console.error("[resend-inbound] processing failed", {
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
