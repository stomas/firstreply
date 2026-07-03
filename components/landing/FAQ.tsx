import { Section, SectionHeading } from "@/components/ui/Section";
import { FAQ as FAQ_DATA } from "@/lib/constants";

export function FAQ() {
  return (
    <Section id="duk" tone="tint" maxWidth="860px">
      <SectionHeading eyebrow={FAQ_DATA.eyebrow} title={FAQ_DATA.title} centered />

      <div className="mt-10 flex flex-col gap-3">
        {FAQ_DATA.items.map((item) => (
          <details
            key={item.q}
            className="group overflow-hidden rounded-2xl border border-line bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-[16.5px] font-bold text-ink">
                {item.q}
              </span>
              <span className="flex flex-none text-brand transition-transform group-open:rotate-180">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </summary>
            <p className="px-[22px] pb-[22px] text-[15px] leading-[1.65] text-ink-soft">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
