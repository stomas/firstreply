import { Card } from "@/components/ui/Card";
import { Section, SectionHeading } from "@/components/ui/Section";
import { SOLUTION } from "@/lib/constants";

export function Solution() {
  return (
    <Section id="sprendimas" className="bg-surface">
      <SectionHeading
        eyebrow="Sprendimas"
        title={SOLUTION.title}
        subtitle={SOLUTION.intro}
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SOLUTION.points.map((point) => (
          <Card key={point.title}>
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h3 className="mt-4 font-semibold text-ink">{point.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {point.text}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
