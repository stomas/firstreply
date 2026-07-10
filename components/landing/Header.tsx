"use client";

import { useState } from "react";
import { NAV_ITEMS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-[11px] bg-brand font-display font-extrabold text-white shadow-[0_3px_10px_rgba(15,143,106,0.28)]",
        className,
      )}
    >
      FR
    </span>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/[0.82] backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-content items-center justify-between gap-4 px-6">
        <a
          href="#hero"
          className="flex items-center gap-[11px]"
          aria-label={SITE.name}
        >
          <LogoMark className="h-[38px] w-[38px] text-[15px] tracking-[-0.02em]" />
          <span className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">
            {SITE.name}
          </span>
        </a>

        <nav
          className="hidden items-center gap-[30px] md:flex"
          aria-label="Pagrindinė navigacija"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[15px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-[10px]">
          <a
            href="/login"
            className="hidden px-2 py-[11px] text-[15px] font-bold text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            Prisijungti
          </a>
          <a
            href="/signup"
            className="hidden rounded-xl bg-brand px-5 py-[11px] text-[15px] font-bold text-white shadow-cta transition-colors hover:bg-brand-hover md:inline-flex"
          >
            Registruotis
          </a>
          <button
            type="button"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px] border border-line bg-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Uždaryti meniu" : "Atidaryti meniu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10201B"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "border-t border-line bg-white md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav
          className="mx-auto flex max-w-content flex-col gap-1 px-6 py-[14px] pb-5"
          aria-label="Mobili navigacija"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-1.5 py-3 text-base font-semibold text-ink hover:bg-line-soft"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-lg px-1.5 py-3 text-center text-base font-semibold text-ink hover:bg-line-soft"
          >
            Prisijungti
          </a>
          <a
            href="/signup"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-brand py-[14px] text-center text-base font-bold text-white"
          >
            Registruotis
          </a>
        </nav>
      </div>
    </header>
  );
}
