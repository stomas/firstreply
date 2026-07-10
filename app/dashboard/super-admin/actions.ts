"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-context";
import {
  createSuperAdminPricingRule,
  createSuperAdminRequirement,
  createSuperAdminService,
  createSuperAdminSubject,
  deactivateSuperAdminPricingRule,
  deactivateSuperAdminRequirement,
  deleteSuperAdminService,
  deleteSuperAdminSubject,
  parseAdvancedRequirementForm,
  parsePricingBuilderForm,
  parseSuperAdminServiceForm,
  parseSubjectForm,
  updateSuperAdminPricingRule,
  updateSuperAdminRequirement,
  updateSuperAdminSubject,
} from "@/lib/dashboard/super-admin";
import {
  createSuperAdminLocationZone,
  createSuperAdminResponseTemplate,
  createSuperAdminScheduleRule,
  deactivateSuperAdminResponseTemplate,
  deleteSuperAdminLocationZone,
  deleteSuperAdminScheduleRule,
  parseAutosendPolicyForm,
  parseLocationZoneForm,
  parseResponseTemplateForm,
  parseScheduleRuleForm,
  saveSuperAdminAutosendPolicy,
  updateSuperAdminLocationZone,
  updateSuperAdminResponseTemplate,
  updateSuperAdminScheduleRule,
} from "@/lib/dashboard/super-admin-operational";

const SUPER_ADMIN_PATH = "/dashboard/super-admin";

export async function createSuperAdminServiceAction(formData: FormData) {
  const parsed = parseSuperAdminServiceForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminService(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deleteSuperAdminServiceAction(serviceId: string) {
  const client = await getCurrentClient();
  const result = await deleteSuperAdminService(client.id, serviceId);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

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

export async function createSuperAdminLocationZoneAction(formData: FormData) {
  const parsed = parseLocationZoneForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminLocationZone(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminLocationZoneAction(formData: FormData) {
  const parsed = parseLocationZoneForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminLocationZone(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deleteSuperAdminLocationZoneAction(
  locationZoneId: string,
) {
  const client = await getCurrentClient();
  const result = await deleteSuperAdminLocationZone(client.id, locationZoneId);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

export async function createSuperAdminScheduleRuleAction(formData: FormData) {
  const parsed = parseScheduleRuleForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminScheduleRule(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminScheduleRuleAction(formData: FormData) {
  const parsed = parseScheduleRuleForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminScheduleRule(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deleteSuperAdminScheduleRuleAction(
  scheduleRuleId: string,
) {
  const client = await getCurrentClient();
  const result = await deleteSuperAdminScheduleRule(client.id, scheduleRuleId);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

export async function saveSuperAdminAutosendPolicyAction(formData: FormData) {
  const parsed = parseAutosendPolicyForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await saveSuperAdminAutosendPolicy(client.id, parsed.value);
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function createSuperAdminResponseTemplateAction(
  formData: FormData,
) {
  const parsed = parseResponseTemplateForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await createSuperAdminResponseTemplate(
    client.id,
    parsed.value,
  );
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function updateSuperAdminResponseTemplateAction(
  formData: FormData,
) {
  const parsed = parseResponseTemplateForm(formData);
  if (!parsed.ok) {
    redirectWithError(parsed.error);
  }

  const client = await getCurrentClient();
  const result = await updateSuperAdminResponseTemplate(
    client.id,
    parsed.value,
  );
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?updated=1`);
}

export async function deactivateSuperAdminResponseTemplateAction(
  responseTemplateId: string,
) {
  const client = await getCurrentClient();
  const result = await deactivateSuperAdminResponseTemplate(
    client.id,
    responseTemplateId,
  );
  if (!result.ok) {
    redirectWithError(result.error);
  }

  revalidateSuperAdmin();
  redirect(`${SUPER_ADMIN_PATH}?deleted=1`);
}

function revalidateSuperAdmin() {
  revalidatePath(SUPER_ADMIN_PATH);
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/test");
}

function redirectWithError(error: string): never {
  redirect(`${SUPER_ADMIN_PATH}?error=${encodeURIComponent(error)}`);
}
