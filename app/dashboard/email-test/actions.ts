"use server";

import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentSuperAdminClient } from "@/lib/client-context";
import { sendTestEmail } from "@/lib/outbound/test-email";

export type SendTestEmailActionResult =
  | { ok: true; message: string; messageId: string }
  | { ok: false; message: string };

export async function sendTestEmailAction(
  formData: FormData,
): Promise<SendTestEmailActionResult> {
  try {
    const client = await getCurrentSuperAdminClient();
    const result = await sendTestEmail({
      clientId: client.id,
      recipient: readText(formData, "recipient"),
      subject: readText(formData, "subject"),
      text: readText(formData, "text"),
      requestId: readText(formData, "requestId"),
    });
    return {
      ok: true,
      message: "Testinis laiškas priimtas siųsti.",
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("[dashboard-test-email] send failed", error);
    return { ok: false, message: getAppErrorMessage(error) };
  }
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
