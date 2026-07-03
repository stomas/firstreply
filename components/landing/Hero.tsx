import { Button } from "@/components/ui/Button";
import { HERO } from "@/lib/constants";

export function Hero() {
  return (
    <section
      id="top"
      className="bg-surface relative overflow-hidden border-b border-slate-200"
    >
      {/* Subtle top glow — restrained, no heavy gradients. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-brand-100/60 to-transparent"
      />
      <div className="relative mx-auto max-w-content px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-brand-500"
            />
            {HERO.salesAngle}
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {HERO.headline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            {HERO.subheadline}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="#demo" size="lg" className="w-full sm:w-auto">
              {HERO.primaryCta}
            </Button>
            <Button
              href="#demo-pavyzdziai"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              {HERO.secondaryCta}
            </Button>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="text-brand-600"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {HERO.riskReversal}
          </p>
        </div>
      </div>
    </section>
  );
}
