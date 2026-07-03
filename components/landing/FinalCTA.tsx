import { LeadForm } from "@/components/landing/LeadForm";
import { Section } from "@/components/ui/Section";
import { FINAL_CTA } from "@/lib/constants";

export function FinalCTA() {
  return (
    <Section id="demo">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="lg:pt-6">
          <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {FINAL_CTA.headline}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            {FINAL_CTA.subtext}
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Pereisime jūsų tipinę užklausą kartu",
              "Parodysime, koks atsakymas būtų paruoštas",
              "Aptarsime kainodaros ir sprendimų taisykles",
              "Be įsipareigojimų — tiesiog pasižiūrėsite, kaip veikia",
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
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
                <span className="text-sm leading-relaxed text-ink-soft">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <LeadForm />
      </div>
    </Section>
  );
}
