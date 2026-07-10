import Link from "next/link";
import { redirect } from "next/navigation";
import { superAdminSignupAction } from "@/app/auth/actions";
import {
  AuthCard,
  AuthSubmitButton,
  authInputClass,
} from "@/components/auth/AuthCard";
import { getAuthSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function SuperAdminSignupPage({
  searchParams,
}: PageProps) {
  if (await getAuthSession()) {
    redirect("/dashboard");
  }

  const query = await searchParams;

  return (
    <AuthCard
      eyebrow="Vidinė prieiga"
      title="Super Admin registracija"
      description="Ši registracija skirta tik FirstReply sistemos administratoriams."
      error={query?.error}
      footer={
        <Link href="/login" className="font-bold text-brand hover:underline">
          Grįžti į prisijungimą
        </Link>
      }
    >
      <form action={superAdminSignupAction} className="grid gap-4">
        <label className="text-sm font-bold text-ink">
          El. paštas
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className={authInputClass}
          />
        </label>
        <label className="text-sm font-bold text-ink">
          Slaptažodis
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className={authInputClass}
          />
          <span className="mt-1 block text-xs font-normal text-ink-muted">
            Bent 12 simbolių.
          </span>
        </label>
        <label className="text-sm font-bold text-ink">
          Pakartokite slaptažodį
          <input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className={authInputClass}
          />
        </label>
        <label className="text-sm font-bold text-ink">
          Registracijos kodas
          <input
            name="signupCode"
            type="password"
            autoComplete="off"
            required
            maxLength={256}
            className={authInputClass}
          />
        </label>
        <AuthSubmitButton>Sukurti Super Admin paskyrą</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
