import { Card } from "@/components/ui/Card";
import { Section, SectionHeading } from "@/components/ui/Section";
import { SEGMENTS } from "@/lib/constants";

// A small, neutral line icon per segment — no cheesy robot imagery.
const icons: Record<string, React.ReactNode> = {
  Terasos: <path d="M3 10h18M5 10v10m14-10v10M3 20h18M4 10 12 4l8 6" />,
  Tvoros: <path d="M4 20V8l3-3 3 3v12M14 20V8l3-3 3 3v12M2 12h20" />,
  Stoginės: <path d="M3 10 12 4l9 6M5 10v10h14V10M3 20h18" />,
  Vartai: <path d="M4 20V6h7v14M13 20V6h7v14M2 20h20M7 10v6m10-6v6" />,
  "Standartiniai montavimo darbai": (
    <path d="m14 7 3 3-8 8-3-3 8-8ZM14 7l2-2 3 3-2 2M5 19l-1 1" />
  ),
};

export function Segments() {
  return (
    <Section id="kam-skirta" className="bg-surface">
      <SectionHeading
        eyebrow="Kam skirta"
        title="Sukurta konkretiems montavimo darbams"
        subtitle="Pradedame nuo sričių, kur klausimai ir kainodara pasikartoja — ten automatinis atsakymas duoda daugiausiai naudos."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENTS.map((segment) => (
          <Card key={segment.title} className="flex flex-col">
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icons[segment.title]}
              </svg>
            </span>
            <h3 className="mt-4 text-lg font-semibold text-ink">
              {segment.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {segment.text}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
