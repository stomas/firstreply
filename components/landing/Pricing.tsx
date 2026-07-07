import { Section, SectionHeading } from "@/components/ui/Section";
import { PRICING } from "@/lib/constants";

export function Pricing() {
  const { starter, pro } = PRICING;

  return (
    <Section id="kaina" tone="tint" maxWidth="1000px">
      <SectionHeading
        eyebrow={PRICING.eyebrow}
        title={PRICING.title}
        centered
      />

      <div className="mt-11 grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {/* Starter — active */}
        <article className="relative rounded-[24px] border-2 border-brand bg-white p-[clamp(26px,4vw,36px)] shadow-pricing">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-2xl font-extrabold text-ink">
              {starter.name}
            </h3>
            <span className="rounded-full border border-brand-tintborder bg-brand-tint px-[13px] py-[6px] text-xs font-bold text-brand">
              {starter.badge}
            </span>
          </div>
          <div className="mt-5">
            <div className="font-display text-[clamp(30px,5vw,40px)] font-extrabold tracking-[-0.03em] text-ink">
              {starter.monthly}
              <span className="text-[18px] font-semibold text-ink-muted">
                {starter.monthlyNote}
              </span>
            </div>
            <div className="mt-1 text-[15px] text-ink-soft">
              {starter.setupNote}
            </div>
          </div>
          <p className="mt-[14px] text-sm leading-[1.55] text-ink-soft">
            {starter.highlight}
          </p>
          <a
            href="#cta"
            className="mt-[22px] block rounded-[14px] bg-brand py-[15px] text-center text-base font-bold text-white shadow-cta transition-colors hover:bg-brand-hover"
          >
            {starter.cta}
          </a>
          <div className="mt-6 flex flex-col gap-[11px] border-t border-line-soft pt-5">
            {starter.features.map((f) => (
              <div
                key={f}
                className="flex items-start gap-[11px] text-[14.5px] leading-[1.45] text-ink"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0F8F6A"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-none"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Pro — coming soon */}
        <article className="rounded-[24px] border border-line bg-page p-[clamp(26px,4vw,36px)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-2xl font-extrabold text-ink-soft">
              {pro.name}
            </h3>
            <span className="rounded-full border border-line bg-line-soft px-[13px] py-[6px] text-xs font-bold text-ink-muted">
              {pro.badge}
            </span>
          </div>
          <div className="mt-5">
            <div className="font-display text-[clamp(30px,5vw,40px)] font-extrabold tracking-[-0.03em] text-ink-soft">
              {pro.monthly}
              <span className="text-[18px] font-semibold text-ink-muted">
                {pro.monthlyNote}
              </span>
            </div>
            <div className="mt-1 text-[15px] text-ink-muted">
              {pro.subtitle}
            </div>
          </div>
          <div className="mt-[22px] block cursor-not-allowed rounded-[14px] border border-line bg-line-soft py-[15px] text-center text-base font-bold text-ink-muted">
            {pro.ctaLabel}
          </div>
          <div className="mt-6 flex flex-col gap-[11px] border-t border-line pt-5">
            {pro.features.map((f) => (
              <div
                key={f}
                className="flex items-start gap-[11px] text-[14.5px] leading-[1.45] text-ink-soft"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7A8A85"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-none"
                  aria-hidden
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </Section>
  );
}
