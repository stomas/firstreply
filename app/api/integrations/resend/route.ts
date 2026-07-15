import { NextResponse } from "next/server";
import { handleResendWebhookRequest } from "@/lib/resend/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleResendWebhookRequest(request, "all_email_events");
}

export function GET() {
  return NextResponse.json({ ok: false, error: "Use POST." }, { status: 405 });
}
