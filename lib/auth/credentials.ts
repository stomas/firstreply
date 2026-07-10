import { z } from "zod";

type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type LoginCredentials = {
  email: string;
  password: string;
};

export type ClientSignupCredentials = LoginCredentials & {
  companyName: string;
};

export type SuperAdminSignupCredentials = LoginCredentials & {
  signupCode: string;
};

const emailSchema = z.string().email().max(254);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) {
    return "Slaptažodį turi sudaryti bent 12 simbolių.";
  }

  if (password.length > 128) {
    return "Slaptažodis negali būti ilgesnis nei 128 simboliai.";
  }

  return null;
}

export function parseLoginForm(
  formData: FormData,
): FormResult<LoginCredentials> {
  const email = normalizeEmail(readFormString(formData, "email"));
  const password = readFormString(formData, "password");

  if (
    !emailSchema.safeParse(email).success ||
    !password ||
    password.length > 128
  ) {
    return { ok: false, error: "Įveskite el. paštą ir slaptažodį." };
  }

  return { ok: true, value: { email, password } };
}

export function parseClientSignupForm(
  formData: FormData,
): FormResult<ClientSignupCredentials> {
  const companyName = readFormString(formData, "companyName").trim();
  const base = parseSignupBase(formData);

  if (companyName.length < 2 || companyName.length > 120) {
    return {
      ok: false,
      error: "Įmonės pavadinimą turi sudaryti nuo 2 iki 120 simbolių.",
    };
  }

  if (!base.ok) {
    return base;
  }

  return { ok: true, value: { companyName, ...base.value } };
}

export function parseSuperAdminSignupForm(
  formData: FormData,
): FormResult<SuperAdminSignupCredentials> {
  const base = parseSignupBase(formData);
  const signupCode = readFormString(formData, "signupCode").trim();

  if (!base.ok) {
    return base;
  }

  if (!signupCode || signupCode.length > 256) {
    return { ok: false, error: "Įveskite Super Admin registracijos kodą." };
  }

  return { ok: true, value: { ...base.value, signupCode } };
}

function parseSignupBase(formData: FormData): FormResult<LoginCredentials> {
  const email = normalizeEmail(readFormString(formData, "email"));
  const password = readFormString(formData, "password");
  const passwordConfirmation = readFormString(formData, "passwordConfirmation");

  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "Įveskite teisingą el. pašto adresą." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  if (password !== passwordConfirmation) {
    return { ok: false, error: "Slaptažodžiai nesutampa." };
  }

  return { ok: true, value: { email, password } };
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
