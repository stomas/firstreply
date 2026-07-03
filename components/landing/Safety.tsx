import { Section, SectionHeading } from "@/components/ui/Section";
import { SAFETY } from "@/lib/constants";

export function Safety() {
  return (
    <Section id="sauga">
      <SectionHeading
        eyebrow="Sauga ir ribos"
        title={SAFETY.title}
        subtitle={SAFETY.intro}
      />

      <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <ul className="divide-y divide-slate-100">
          {SAFETY.points.map((point) => (
            <li key={point.title} className="flex gap-4 p-5 sm:p-6">
              <span
                aria-hidden
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-600"
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
              </span>
              <div>
                <h3 className="font-semibold text-ink">{point.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {point.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
