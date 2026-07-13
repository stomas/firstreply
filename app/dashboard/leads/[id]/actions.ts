"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthSession } from "@/lib/auth/session";
import { getCurrentClient } from "@/lib/client-context";
import {
  closeConversation,
  markConversationAnsweredExternally,
  reopenConversation,
} from "@/lib/inbound/conversations";

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
