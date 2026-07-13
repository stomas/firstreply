"use server";

import { SourceIntegrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  createPaslaugosLtIntegration,
  createWebFormIntegration,
  rotateSourceIntegration,
  setSourceIntegrationStatus,
} from "@/lib/inbound/integrations";

export async function createWebFormIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  await createWebFormIntegration({
    clientId: client.id,
    name: readText(formData, "name"),
  });
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?created=web-form");
}

export async function createPaslaugosIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  await createPaslaugosLtIntegration({
    clientId: client.id,
    name: readText(formData, "name"),
  });
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?created=paslaugos-lt");
}

export async function setIntegrationStatusAction(formData: FormData) {
  const client = await getCurrentClient();
  const integrationId = requireText(formData, "integrationId");
  const statusValue = requireText(formData, "status");
  const status =
    statusValue === SourceIntegrationStatus.ACTIVE
      ? SourceIntegrationStatus.ACTIVE
      : SourceIntegrationStatus.DISABLED;
  await setSourceIntegrationStatus({
    clientId: client.id,
    integrationId,
    status,
  });
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?updated=1");
}

export async function rotateIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  await rotateSourceIntegration({
    clientId: client.id,
    integrationId: requireText(formData, "integrationId"),
  });
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?rotated=1");
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
