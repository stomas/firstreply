import { Button } from "@/components/ui/Button";
import { LeadForm } from "@/components/landing/LeadForm";
import { FINAL_CTA } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section id="cta" className="px-6 py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[820px] text-center">
        <h2 className="text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink [text-wrap:balance]">
          {FINAL_CTA.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-soft">
          {FINAL_CTA.subtext}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="#offer-form" size="lg">
            {FINAL_CTA.cta}
          </Button>
          <Button href="/demo" size="lg" variant="secondary">
            {FINAL_CTA.secondaryCta}
          </Button>
        </div>
      </div>

      <div
        id="offer-form"
        className="mx-auto mt-10 max-w-[720px] rounded-[24px] border border-line bg-white p-[clamp(24px,4vw,40px)] shadow-[0_20px_50px_-28px_rgba(16,32,27,0.3)]"
      >
        <LeadForm />
      </div>
    </section>
  );
}
