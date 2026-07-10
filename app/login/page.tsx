import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth/actions";
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

export default async function LoginPage({ searchParams }: PageProps) {
  if (await getAuthSession()) {
    redirect("/dashboard");
  }

  const query = await searchParams;

  return (
    <AuthCard
      eyebrow="Paskyra"
      title="Prisijungimas"
      description="Prisijunkite prie savo įmonės FirstReply valdymo aplinkos."
      error={query?.error}
      footer={
        <>
          Neturite paskyros?{" "}
          <Link href="/signup" className="font-bold text-brand hover:underline">
            Registruotis
          </Link>
        </>
      }
    >
      <form action={loginAction} className="grid gap-4">
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
            autoComplete="current-password"
            required
            maxLength={128}
            className={authInputClass}
          />
        </label>
        <AuthSubmitButton>Prisijungti</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
