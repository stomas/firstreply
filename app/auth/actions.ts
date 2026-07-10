"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseClientSignupForm,
  parseLoginForm,
  parseSuperAdminSignupForm,
} from "@/lib/auth/credentials";
import {
  hashPassword,
  isValidSuperAdminSignupCode,
  verifyPassword,
} from "@/lib/auth/password";
import { getDashboardReturnPath } from "@/lib/auth/redirect";
import {
  createAuthSession,
  deleteCurrentAuthSession,
  requireSuperAdminSession,
} from "@/lib/auth/session";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export async function loginAction(formData: FormData) {
  const parsed = parseLoginForm(formData);
  if (!parsed.ok) {
    redirectWithError("/login", parsed.error);
  }

  assertDatabaseConfigured();

  const user = await prisma.user.findUnique({
    where: { email: parsed.value.email },
    include: { client: { select: { status: true } } },
  });

  const passwordMatches = user
    ? await verifyPassword(parsed.value.password, user.passwordHash)
    : await consumePasswordVerificationTime(parsed.value.password);

  const clientAccessIsActive =
    user?.role === "SUPER_ADMIN" || user?.client?.status === "active";

  if (!user || !passwordMatches || !clientAccessIsActive) {
    redirectWithError("/login", "Neteisingas el. paštas arba slaptažodis.");
  }

  await createAuthSession(user.id);
  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const parsed = parseClientSignupForm(formData);
  if (!parsed.ok) {
    redirectWithError("/signup", parsed.error);
  }

  assertDatabaseConfigured();
  const passwordHash = await hashPassword(parsed.value.password);

  let userId: string;
  try {
    userId = await prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({
        data: {
          name: parsed.value.companyName,
          ownerEmail: parsed.value.email,
        },
      });
      const client = await transaction.client.create({
        data: {
          tenantId: tenant.id,
          companyName: parsed.value.companyName,
          ownerEmail: parsed.value.email,
        },
      });
      const user = await transaction.user.create({
        data: {
          email: parsed.value.email,
          passwordHash,
          role: "CLIENT",
          clientId: client.id,
        },
        select: { id: true },
      });

      return user.id;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirectWithError(
        "/signup",
        "Paskyros su šiuo el. paštu sukurti nepavyko.",
      );
    }
    throw error;
  }

  await createAuthSession(userId);
  redirect("/dashboard");
}

export async function superAdminSignupAction(formData: FormData) {
  const parsed = parseSuperAdminSignupForm(formData);
  if (!parsed.ok) {
    redirectWithError("/super-admin/signup", parsed.error);
  }

  if (
    !isValidSuperAdminSignupCode(
      parsed.value.signupCode,
      process.env.SUPER_ADMIN_SIGNUP_CODE,
    )
  ) {
    redirectWithError(
      "/super-admin/signup",
      "Neteisingas Super Admin registracijos kodas.",
    );
  }

  assertDatabaseConfigured();
  const passwordHash = await hashPassword(parsed.value.password);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.value.email,
        passwordHash,
        role: "SUPER_ADMIN",
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirectWithError(
        "/super-admin/signup",
        "Paskyros su šiuo el. paštu sukurti nepavyko.",
      );
    }
    throw error;
  }

  await createAuthSession(userId);
  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteCurrentAuthSession();
  redirect("/login");
}

export async function selectSuperAdminClientAction(formData: FormData) {
  const session = await requireSuperAdminSession();
  const clientId = formData.get("clientId");
  const returnTo = getDashboardReturnPath(formData.get("returnTo"));

  if (typeof clientId !== "string" || !clientId) {
    redirectWithError("/dashboard", "Pasirinkite klientą.");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, status: "active" },
    select: { id: true },
  });
  if (!client) {
    redirectWithError("/dashboard", "Pasirinktas klientas nerastas.");
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { selectedClientId: client.id },
  });

  revalidatePath("/dashboard", "layout");
  redirect(returnTo);
}

async function consumePasswordVerificationTime(password: string) {
  await hashPassword(password);
  return false;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}
