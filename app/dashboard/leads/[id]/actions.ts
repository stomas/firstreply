"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthSession } from "@/lib/auth/session";
import { getCurrentClient } from "@/lib/client-context";
import { getAppErrorMessage } from "@/lib/app-errors";
import {
  closeConversation,
  markConversationAnsweredExternally,
  reopenConversation,
} from "@/lib/inbound/conversations";
import { sendConversationResponse } from "@/lib/outbound/send";

export async function markAnsweredExternallyAction(formData: FormData) {
  const [client, session] = await Promise.all([
    getCurrentClient(),
    requireAuthSession(),
  ]);
  const leadId = requireText(formData, "leadId");
  await markConversationAnsweredExternally({
    clientId: client.id,
    leadId,
    actorUserId: session.user.id,
    note: readText(formData, "note"),
  });
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/leads/${leadId}?conversationUpdated=1`);
}

export async function reopenConversationAction(formData: FormData) {
  const [client, session] = await Promise.all([
    getCurrentClient(),
    requireAuthSession(),
  ]);
  const leadId = requireText(formData, "leadId");
  await reopenConversation({
    clientId: client.id,
    leadId,
    actorUserId: session.user.id,
  });
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/leads/${leadId}?conversationUpdated=1`);
}

export async function closeConversationAction(formData: FormData) {
  const [client, session] = await Promise.all([
    getCurrentClient(),
    requireAuthSession(),
  ]);
  const leadId = requireText(formData, "leadId");
  await closeConversation({
    clientId: client.id,
    leadId,
    actorUserId: session.user.id,
  });
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/leads/${leadId}?conversationUpdated=1`);
}

export async function sendConversationResponseAction(formData: FormData) {
  const [client, session] = await Promise.all([
    getCurrentClient(),
    requireAuthSession(),
  ]);
  const leadId = requireText(formData, "leadId");
  let errorMessage: string | null = null;
  let result: Awaited<ReturnType<typeof sendConversationResponse>> | null =
    null;
  try {
    result = await sendConversationResponse({
      clientId: client.id,
      sentByUserId: session.user.id,
      leadId,
      responseRevisionId: requireText(formData, "responseRevisionId"),
      sendRequestId: requireText(formData, "sendRequestId"),
      subject: requireText(formData, "subject"),
      text: requireText(formData, "text"),
    });
  } catch (error) {
    console.error("[outbound-send] failed", error);
    errorMessage = getAppErrorMessage(error);
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  if (errorMessage) {
    redirect(
      `/dashboard/leads/${leadId}?sendError=${encodeURIComponent(errorMessage)}`,
    );
  }
  redirect(`/dashboard/leads/${leadId}?sent=${result?.status ?? "sent"}`);
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function requireText(formData: FormData, key: string): string {
  const value = readText(formData, key).trim();
  if (!value) {
    throw new Error(`Missing ${key}.`);
  }
  return value;
}
