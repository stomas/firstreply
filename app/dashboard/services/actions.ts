"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  parseDashboardServiceForm,
  updateDashboardService,
} from "@/lib/dashboard/services";

export async function updateDashboardServiceAction(formData: FormData) {
  const parsed = parseDashboardServiceForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.serviceId, parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateDashboardService(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(parsed.value.serviceId, result.error);
  }

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${parsed.value.serviceId}`);
  redirect("/dashboard/services?updated=1");
}

function redirectWithError(serviceId: string | null, error: string): never {
  const target = serviceId
    ? `/dashboard/services/${serviceId}`
    : "/dashboard/services";

  redirect(`${target}?error=${encodeURIComponent(error)}`);
}
