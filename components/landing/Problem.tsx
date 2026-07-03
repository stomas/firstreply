import { Section, SectionHeading } from "@/components/ui/Section";
import { PROBLEM } from "@/lib/constants";

export function Problem() {
  return (
    <Section id="problema">
      <SectionHeading eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} />

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PROBLEM.items.map((p) => (
          <div
            key={p.title}
            className="rounded-[20px] border border-line bg-white p-[26px] shadow-card"
          >
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px] border border-warn-border bg-warn-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="mt-4 text-[19px] font-bold tracking-[-0.01em] text-ink">
              {p.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {p.text}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
