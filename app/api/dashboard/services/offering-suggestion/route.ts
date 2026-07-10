import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AppAuthenticationError,
  AppAuthorizationError,
  getAppErrorMessage,
} from "@/lib/app-errors";
import {
  generateOfferingSuggestion,
  isOfferingTone,
} from "@/lib/ai/offering-suggestion";
import { getCurrentClient } from "@/lib/client-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  serviceId: z.string().min(1),
  tone: z.string().min(1),
});

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

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success || !isOfferingTone(parsed.data.tone)) {
    return NextResponse.json(
      { ok: false, error: "Netinkami parametrai." },
      { status: 422 },
    );
  }

  try {
    const client = await getCurrentClient();
    const result = await generateOfferingSuggestion(
      client.id,
      parsed.data.serviceId,
      parsed.data.tone,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      description: result.description,
      followup: result.followup,
    });
  } catch (error) {
    console.error("[offering-suggestion] failed:", error);
    if (error instanceof AppAuthenticationError) {
      return NextResponse.json(
        { ok: false, error: getAppErrorMessage(error) },
        { status: 401 },
      );
    }
    if (error instanceof AppAuthorizationError) {
      return NextResponse.json(
        { ok: false, error: getAppErrorMessage(error) },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: getAppErrorMessage(error) },
      { status: 500 },
    );
  }
}
