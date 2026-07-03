import Link from "next/link";
import { FOOTER, SITE } from "@/lib/constants";

export function Footer() {
  const year = 2026;

  return (
    <footer className="bg-footer-bg px-6 pb-10 pt-[clamp(48px,7vw,72px)] text-footer-text">
      <div className="mx-auto grid max-w-content items-start gap-8 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <div className="max-w-[360px]">
          <div className="flex items-center gap-[11px]">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand font-display text-sm font-extrabold text-white">
              FR
            </span>
            <span className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-white">
              {SITE.name}
            </span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-footer-soft">
            {FOOTER.description}
          </p>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-footer-faint">
            Navigacija
          </div>
          <div className="mt-[14px] flex flex-col gap-[10px]">
            {FOOTER.nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[15px] text-footer-text hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-footer-faint">
            Kontaktai
          </div>
          <div className="mt-[14px] flex flex-col gap-[10px]">
            <a
              href={`mailto:${SITE.email}`}
              className="text-[15px] text-footer-text hover:text-white"
            >
              {SITE.email}
            </a>
            <a
              href={`https://${SITE.domain}`}
              className="text-[15px] text-footer-text hover:text-white"
            >
              {SITE.domain}
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-9 flex max-w-content flex-wrap items-center justify-between gap-4 border-t border-footer-line pt-6">
        <span className="text-[13px] text-footer-faint">
          © {year} {SITE.name} · {SITE.domain}
        </span>
        <div className="flex gap-5">
          {FOOTER.legal.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] text-footer-soft hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
