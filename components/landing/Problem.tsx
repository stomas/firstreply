import { Card } from "@/components/ui/Card";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PROBLEMS } from "@/lib/constants";

export function Problem() {
  return (
    <Section id="problema">
      <SectionHeading
        eyebrow="Problema"
        title="Užklausų netrūksta — trūksta laiko atsakyti pirmam"
        subtitle="Mažoms montavimo įmonėms didžiausias praradimas dažnai būna ne kaina, o vėluojantis atsakymas."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {PROBLEMS.map((p) => (
          <Card key={p.title} className="flex gap-4">
            <span
              aria-hidden
              className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-50 text-red-500"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <div>
              <h3 className="font-semibold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {p.text}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
