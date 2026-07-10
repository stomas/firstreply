import Link from "next/link";
import type { ReactNode } from "react";

export const authInputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function AuthCard({
  eyebrow,
  title,
  description,
  error,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  error?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mx-auto mb-6 block w-fit font-display text-xl font-extrabold text-brand"
        >
          FirstReply
        </Link>
        <section className="rounded-2xl border border-line bg-white p-6 shadow-cardsoft sm:p-8">
          <div className="text-xs font-extrabold uppercase tracking-[0.08em] text-brand">
            {eyebrow}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {description}
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
            {footer}
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthSubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-2 w-full rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white shadow-cta transition-colors hover:bg-brand-hover"
    >
      {children}
    </button>
  );
}
