"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  parseDashboardPricingRuleForm,
  parseDashboardRequirementForm,
  updateDashboardPricingRule,
  updateDashboardRequirement,
} from "@/lib/dashboard/rules";

export async function updateDashboardPricingRuleAction(formData: FormData) {
  const parsed = parseDashboardPricingRuleForm(formData);
  if (!parsed.ok) {
    redirectWithError("pricing", parsed.pricingRuleId, parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateDashboardPricingRule(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError("pricing", parsed.value.pricingRuleId, result.error);
  }

  revalidatePath("/dashboard/rules");
  revalidatePath(`/dashboard/rules/pricing/${parsed.value.pricingRuleId}`);
  redirect("/dashboard/rules?updated=1");
}

export async function updateDashboardRequirementAction(formData: FormData) {
  const parsed = parseDashboardRequirementForm(formData);
  if (!parsed.ok) {
    redirectWithError("requirements", parsed.requirementId, parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateDashboardRequirement(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError("requirements", parsed.value.requirementId, result.error);
  }

  revalidatePath("/dashboard/rules");
  revalidatePath(`/dashboard/rules/requirements/${parsed.value.requirementId}`);
  redirect("/dashboard/rules?updated=1");
}

function redirectWithError(
  kind: "pricing" | "requirements",
  id: string | null,
  error: string,
): never {
  const target = id ? `/dashboard/rules/${kind}/${id}` : "/dashboard/rules";
  redirect(`${target}?error=${encodeURIComponent(error)}`);
}
