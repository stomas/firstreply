import { NextResponse } from "next/server";
import {
  AppConfigError,
  AppNotFoundError,
  AppValidationError,
  getAppErrorMessage,
} from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { createTestLeadAndResponse } from "@/lib/leads/create-test-lead";

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

  try {
    const client = await getCurrentClient();
    const result = await createTestLeadAndResponse(client.id, json);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[dashboard-test] failed to create test lead:", error);

    if (error instanceof AppValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, fields: error.fields ?? {} },
        { status: 422 },
      );
    }

    if (error instanceof AppConfigError || error instanceof AppNotFoundError) {
      return NextResponse.json(
        { ok: false, error: getAppErrorMessage(error) },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "lead creation error" },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "Naudokite POST." },
    { status: 405 },
  );
}
