import { Section, SectionHeading } from "@/components/ui/Section";
import { HOW_IT_WORKS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <Section id="kaip-veikia" maxWidth="760px">
      <SectionHeading
        eyebrow={HOW_IT_WORKS.eyebrow}
        title={HOW_IT_WORKS.title}
        subtitle={HOW_IT_WORKS.intro}
        centered
      />

      <ol className="mt-11 flex flex-col gap-[14px]">
        {HOW_IT_WORKS.steps.map((step) => (
          <li
            key={step.num}
            className="flex items-start gap-[18px] rounded-2xl border border-line bg-white px-[22px] py-5 shadow-cardsoft"
          >
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-brand font-display text-base font-extrabold text-white">
              {step.num}
            </span>
            <div>
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-ink">
                {step.title}
              </h3>
              <p className="mt-[5px] text-[15px] leading-[1.55] text-ink-soft">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
