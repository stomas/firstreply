import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/auth/actions";
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

export default async function SignupPage({ searchParams }: PageProps) {
  if (await getAuthSession()) {
    redirect("/dashboard");
  }

  const query = await searchParams;

  return (
    <AuthCard
      eyebrow="Nauja įmonė"
      title="Sukurti paskyrą"
      description="Registracija sukurs atskirą jūsų įmonės FirstReply klientą."
      error={query?.error}
      footer={
        <>
          Jau turite paskyrą?{" "}
          <Link href="/login" className="font-bold text-brand hover:underline">
            Prisijungti
          </Link>
        </>
      }
    >
      <form action={signupAction} className="grid gap-4">
        <label className="text-sm font-bold text-ink">
          Įmonės pavadinimas
          <input
            name="companyName"
            type="text"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            className={authInputClass}
          />
        </label>
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
        <PasswordFields />
        <AuthSubmitButton>Sukurti įmonės paskyrą</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}

function PasswordFields() {
  return (
    <>
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
    </>
  );
}
