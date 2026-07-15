"use server";

import { SourceIntegrationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import { getAppErrorMessage } from "@/lib/app-errors";
import {
  createPaslaugosLtIntegration,
  createWebFormIntegration,
  rotateSourceIntegration,
  setSourceIntegrationStatus,
} from "@/lib/inbound/integrations";
import {
  createOutboundIntegration,
  refreshOutboundIntegration,
  setDefaultOutboundIntegration,
  setOutboundIntegrationStatus,
} from "@/lib/outbound/integrations";

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

export async function createOutboundIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  try {
    await createOutboundIntegration({
      clientId: client.id,
      name: readText(formData, "name"),
      fromName: readText(formData, "fromName"),
      fromEmail: readText(formData, "fromEmail"),
      replyToEmail: readText(formData, "replyToEmail"),
    });
  } catch (error) {
    console.error("[outbound-integration-create] failed", error);
    redirectOutboundError(error);
  }
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?outboundCreated=1");
}

export async function refreshOutboundIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  try {
    await refreshOutboundIntegration({
      clientId: client.id,
      integrationId: requireText(formData, "integrationId"),
    });
  } catch (error) {
    console.error("[outbound-integration-refresh] failed", error);
    redirectOutboundError(error);
  }
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?outboundUpdated=1");
}

export async function setOutboundIntegrationStatusAction(formData: FormData) {
  const client = await getCurrentClient();
  try {
    await setOutboundIntegrationStatus({
      clientId: client.id,
      integrationId: requireText(formData, "integrationId"),
      enabled: requireText(formData, "enabled") === "true",
    });
  } catch (error) {
    console.error("[outbound-integration-status] failed", error);
    redirectOutboundError(error);
  }
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?outboundUpdated=1");
}

export async function setDefaultOutboundIntegrationAction(formData: FormData) {
  const client = await getCurrentClient();
  try {
    await setDefaultOutboundIntegration({
      clientId: client.id,
      integrationId: requireText(formData, "integrationId"),
    });
  } catch (error) {
    console.error("[outbound-integration-default] failed", error);
    redirectOutboundError(error);
  }
  revalidatePath("/dashboard/integrations");
  redirect("/dashboard/integrations?outboundUpdated=1");
}

function redirectOutboundError(error: unknown): never {
  redirect(
    `/dashboard/integrations?outboundError=${encodeURIComponent(getAppErrorMessage(error))}`,
  );
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
