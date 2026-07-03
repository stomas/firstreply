import { NextResponse } from "next/server";
import { leadSchema, fieldErrors } from "@/lib/lead-schema";

// Run on the Node.js runtime so server-only env vars and console logging
// behave predictably.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Netinkamas užklausos formatas." },
      { status: 400 },
    );
  }

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Patikrinkite formos laukus.",
        fields: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const data = parsed.data;

  // Honeypot: if the hidden field was filled, silently accept but drop it.
  // We return success so bots do not learn they were caught.
  if (data.companyWebsite && data.companyWebsite.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Strip the honeypot before doing anything with the lead.
  const { companyWebsite: _hp, ...lead } = data;
  void _hp;

  const submission = {
    ...lead,
    receivedAt: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };

  // Always log server-side so leads are never lost even without a webhook.
  console.info("[lead] new offer request:", JSON.stringify(submission));

  // Optionally forward to a webhook (Make/Zapier/n8n/Slack/CRM).
  // LEAD_WEBHOOK_URL is a server-only secret — never exposed to the client.
  const webhookUrl = process.env.LEAD_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      if (!res.ok) {
        console.error(
          `[lead] webhook responded with ${res.status} ${res.statusText}`,
        );
        // We still return success to the visitor — the lead is logged and
        // recoverable from server logs; the webhook failure is our problem.
      }
    } catch (err) {
      console.error("[lead] webhook request failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

// Reject other methods clearly.
export function GET() {
  return NextResponse.json(
    { ok: false, error: "Naudokite POST." },
    { status: 405 },
  );
}
