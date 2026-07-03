import Link from "next/link";
import { FOOTER, SITE } from "@/lib/constants";

export function Footer() {
  const year = 2026;

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="max-w-md">
            <div className="flex items-center gap-2 font-bold tracking-tight text-ink">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
              >
                UA
              </span>
              <span>{SITE.name}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {FOOTER.description}
            </p>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            <a
              href={`mailto:${SITE.email}`}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              {SITE.email}
            </a>
            <nav className="flex gap-6" aria-label="Poraštės nuorodos">
              {FOOTER.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-ink-muted hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-ink-muted">
          © {year} {SITE.name}. Visos teisės saugomos.
        </div>
      </div>
    </footer>
  );
}
