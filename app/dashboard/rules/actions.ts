"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  createDashboardPricingRule,
  createDashboardRequirement,
  deleteDashboardPricingRule,
  deleteDashboardRequirement,
  parseDashboardPricingRuleCreateForm,
  parseDashboardPricingRuleForm,
  parseDashboardRequirementCreateForm,
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

export async function createDashboardPricingRuleAction(formData: FormData) {
  const parsed = parseDashboardPricingRuleCreateForm(formData);
  if (!parsed.ok) {
    redirectCreateWithError("pricing", parsed.serviceId, parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createDashboardPricingRule(client.id, parsed.value);
  if (!result.ok) {
    redirectCreateWithError("pricing", parsed.value.serviceId, result.error);
  }

  revalidatePath("/dashboard/rules");
  redirect("/dashboard/rules?updated=1");
}

export async function createDashboardRequirementAction(formData: FormData) {
  const parsed = parseDashboardRequirementCreateForm(formData);
  if (!parsed.ok) {
    redirectCreateWithError("requirements", parsed.serviceId, parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createDashboardRequirement(client.id, parsed.value);
  if (!result.ok) {
    redirectCreateWithError(
      "requirements",
      parsed.value.serviceId,
      result.error,
    );
  }

  revalidatePath("/dashboard/rules");
  redirect("/dashboard/rules?updated=1");
}

export async function deleteDashboardPricingRuleAction(pricingRuleId: string) {
  const client = await getCurrentClient();
  const result = await deleteDashboardPricingRule(client.id, pricingRuleId);
  if (!result.ok) {
    redirectWithError("pricing", pricingRuleId, result.error);
  }

  revalidatePath("/dashboard/rules");
  redirect("/dashboard/rules?deleted=1");
}

export async function deleteDashboardRequirementAction(requirementId: string) {
  const client = await getCurrentClient();
  const result = await deleteDashboardRequirement(client.id, requirementId);
  if (!result.ok) {
    redirectWithError("requirements", requirementId, result.error);
  }

  revalidatePath("/dashboard/rules");
  redirect("/dashboard/rules?deleted=1");
}

function redirectWithError(
  kind: "pricing" | "requirements",
  id: string | null,
  error: string,
): never {
  const target = id ? `/dashboard/rules/${kind}/${id}` : "/dashboard/rules";
  redirect(`${target}?error=${encodeURIComponent(error)}`);
}

function redirectCreateWithError(
  kind: "pricing" | "requirements",
  serviceId: string | null,
  error: string,
): never {
  const encodedError = encodeURIComponent(error);
  const target = serviceId
    ? `/dashboard/rules/${kind}/new?service=${encodeURIComponent(serviceId)}&error=${encodedError}`
    : `/dashboard/rules?error=${encodedError}`;
  redirect(target);
}
