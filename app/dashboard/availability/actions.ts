"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  createDashboardAvailabilityRule,
  deleteDashboardAvailabilityRule,
  parseDashboardAvailabilityCreateForm,
  parseDashboardAvailabilityUpdateForm,
  updateDashboardAvailabilityRule,
} from "@/lib/dashboard/availability";

export async function createDashboardAvailabilityAction(formData: FormData) {
  const parsed = parseDashboardAvailabilityCreateForm(formData);
  if (!parsed.ok) {
    const target = parsed.serviceId
      ? `/dashboard/availability/new?service=${encodeURIComponent(parsed.serviceId)}&error=${encodeURIComponent(parsed.error)}`
      : `/dashboard/availability?error=${encodeURIComponent(parsed.error)}`;
    redirect(target);
  }

  const client = await getCurrentClient();
  const result = await createDashboardAvailabilityRule(client.id, parsed.value);
  if (!result.ok) {
    redirect(
      `/dashboard/availability/new?service=${encodeURIComponent(parsed.value.serviceId)}&error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability?updated=1");
}

export async function deleteDashboardAvailabilityAction(ruleId: string) {
  const client = await getCurrentClient();
  const result = await deleteDashboardAvailabilityRule(client.id, ruleId);
  if (!result.ok) {
    redirect(
      `/dashboard/availability/${ruleId}?error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath("/dashboard/availability");
  redirect("/dashboard/availability?deleted=1");
}

export async function updateDashboardAvailabilityAction(formData: FormData) {
  const parsed = parseDashboardAvailabilityUpdateForm(formData);
  if (!parsed.ok) {
    const target = parsed.ruleId
      ? `/dashboard/availability/${parsed.ruleId}?error=${encodeURIComponent(parsed.error)}`
      : `/dashboard/availability?error=${encodeURIComponent(parsed.error)}`;
    redirect(target);
  }

  const client = await getCurrentClient();
  const result = await updateDashboardAvailabilityRule(client.id, parsed.value);
  if (!result.ok) {
    redirect(
      `/dashboard/availability/${parsed.value.ruleId}?error=${encodeURIComponent(result.error)}`,
    );
  }

  revalidatePath("/dashboard/availability");
  revalidatePath(`/dashboard/availability/${parsed.value.ruleId}`);
  redirect("/dashboard/availability?updated=1");
}
