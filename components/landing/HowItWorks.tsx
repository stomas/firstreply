import { Section, SectionHeading } from "@/components/ui/Section";
import { HOW_IT_WORKS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <Section id="kaip-veikia">
      <SectionHeading
        eyebrow="Kaip veikia"
        title="Nuo užklausos iki atsakymo — septyni žingsniai"
        subtitle="Aiškus, nuspėjamas kelias. Jūs matote kiekvieną etapą ir kontroliuojate, kas siunčiama automatiškai."
      />

      <ol className="mx-auto mt-12 max-w-3xl space-y-4">
        {HOW_IT_WORKS.map((item) => (
          <li
            key={item.step}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <span
              aria-hidden
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
            >
              {item.step}
            </span>
            <div>
              <h3 className="font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {item.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
