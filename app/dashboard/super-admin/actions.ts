"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  createSuperAdminPricingRule,
  createSuperAdminRequirement,
  createSuperAdminSubject,
  deactivateSuperAdminPricingRule,
  deactivateSuperAdminRequirement,
  deleteSuperAdminSubject,
  parseAdvancedRequirementForm,
  parsePricingBuilderForm,
  parseSubjectForm,
  updateSuperAdminPricingRule,
  updateSuperAdminRequirement,
  updateSuperAdminSubject,
} from "@/lib/dashboard/super-admin";

const SUPER_ADMIN_PATH = "/dashboard/super-admin";

export async function createSuperAdminSubjectAction(formData: FormData) {
  const parsed = parseSubjectForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminSubject(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminSubjectAction(formData: FormData) {
  const parsed = parseSubjectForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminSubject(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deleteSuperAdminSubjectAction(subjectId: string) {
  const client = await getCurrentClient();
  const result = await deleteSuperAdminSubject(client.id, subjectId);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

export async function createSuperAdminRequirementAction(formData: FormData) {
  const parsed = parseAdvancedRequirementForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminRequirement(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminRequirementAction(formData: FormData) {
  const parsed = parseAdvancedRequirementForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminRequirement(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deactivateSuperAdminRequirementAction(
  requirementId: string,
) {
  const client = await getCurrentClient();
  const result = await deactivateSuperAdminRequirement(
    client.id,
    requirementId,
  );
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

export async function createSuperAdminPricingRuleAction(formData: FormData) {
  const parsed = parsePricingBuilderForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminPricingRule(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminPricingRuleAction(formData: FormData) {
  const parsed = parsePricingBuilderForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminPricingRule(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deactivateSuperAdminPricingRuleAction(
  pricingRuleId: string,
) {
  const client = await getCurrentClient();
  const result = await deactivateSuperAdminPricingRule(
    client.id,
    pricingRuleId,
  );
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

function revalidateSuperAdmin() {
  revalidatePath(SUPER_ADMIN_PATH);
  revalidatePath("/dashboard/test");
}

function redirectWithError(error: string): never {
  redirect(`${SUPER_ADMIN_PATH}?error=${encodeURIComponent(error)}`);
}
