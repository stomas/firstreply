import { Button } from "@/components/ui/Button";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PRICING } from "@/lib/constants";

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-0.5 flex-none text-brand-600"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span className="text-sm leading-relaxed text-ink-soft">{children}</span>
    </li>
  );
}

export function Pricing() {
  const { starter, pro } = PRICING;

  return (
    <Section id="kaina" className="bg-surface">
      <SectionHeading
        eyebrow="Kaina"
        title="Aiški kaina, be paslėptų mokesčių"
        subtitle="Pradėkite su Starter planu. Pro planas — augančioms įmonėms — jau ruošiamas."
      />

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
        {/* Starter — active */}
        <article className="relative flex flex-col rounded-2xl border-2 border-brand-500 bg-white p-7 shadow-card">
          <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
            {starter.badge}
          </span>

          <h3 className="text-2xl font-bold text-ink">{starter.name}</h3>

          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <span className="text-4xl font-bold text-ink">
                {starter.monthly}
              </span>
              <span className="text-ink-muted">{starter.monthlyNote}</span>
            </div>
            <div className="text-sm text-ink-muted">
              <span className="font-semibold text-ink">{starter.setup}</span>{" "}
              {starter.setupNote}
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
            {starter.highlight}
          </p>

          <Button href="#demo" size="lg" className="mt-6 w-full">
            {starter.cta}
          </Button>

          <ul className="mt-7 space-y-3">
            {starter.features.map((f) => (
              <CheckItem key={f}>{f}</CheckItem>
            ))}
          </ul>
        </article>

        {/* Pro — coming soon */}
        <article className="relative flex flex-col rounded-2xl border border-slate-200 bg-white/70 p-7 shadow-card">
          <span className="absolute -top-3 left-7 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">
            {pro.badge}
          </span>

          <h3 className="text-2xl font-bold text-ink">{pro.name}</h3>

          <div className="mt-4">
            <span className="text-4xl font-bold text-ink">{pro.monthly}</span>
            <span className="text-ink-muted">{pro.monthlyNote}</span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {pro.positioning}
          </p>

          <Button
            size="lg"
            variant="secondary"
            className="mt-6 w-full"
            disabled
          >
            Greit bus
          </Button>

          <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Numatoma įtraukti
          </p>
          <ul className="mt-3 space-y-3">
            {pro.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="mt-0.5 flex-none text-slate-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                <span className="text-sm leading-relaxed text-ink-soft">
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Section>
  );
}
