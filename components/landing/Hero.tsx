import { Button } from "@/components/ui/Button";
import { HERO } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Hero() {
  const { demoCard } = HERO;

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-page"
      style={{
        background:
          "radial-gradient(900px 420px at 50% -80px, #E8F7F1 0%, rgba(232,247,241,0) 70%), #F8FAF9",
      }}
    >
      {/* Dotted backdrop, masked to fade out. */}
      <div
        aria-hidden
        className="bg-dots pointer-events-none absolute inset-0 z-0 opacity-[0.05]"
        style={{
          WebkitMaskImage:
            "radial-gradient(760px 420px at 50% 8%, #000 0%, transparent 78%)",
          maskImage:
            "radial-gradient(760px 420px at 50% 8%, #000 0%, transparent 78%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1000px] px-6 pb-[clamp(48px,6vw,64px)] pt-[clamp(72px,10vw,120px)] text-center">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft shadow-[0_1px_3px_rgba(16,32,27,0.04)]">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-brand" />
          <span className="text-left">{HERO.badge}</span>
        </div>

        <h1 className="mx-auto mt-[26px] max-w-[16ch] text-[clamp(38px,6vw,62px)] font-extrabold leading-[1.0] tracking-[-0.03em] text-ink [text-wrap:balance]">
          {HERO.headline}
        </h1>

        <p className="mx-auto mt-6 max-w-[60ch] text-[clamp(16px,2vw,19px)] leading-relaxed text-ink-soft">
          {HERO.subheadline}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="#cta" size="lg">
            {HERO.primaryCta}
          </Button>
          <Button href="#demo" size="lg" variant="secondary">
            {HERO.secondaryCta}
          </Button>
        </div>

        <div className="mt-[22px] inline-flex items-center gap-2 text-sm text-ink-soft">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F8F6A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span>{HERO.riskReversal}</span>
        </div>

        <p className="mx-auto mt-3 text-[13px] text-ink-muted">{HERO.priceLine}</p>

        {/* Hero mini UI */}
        <div className="mx-auto mt-[clamp(40px,6vw,56px)] max-w-[560px] overflow-hidden rounded-[22px] border border-line bg-white text-left shadow-hero">
          <div className="flex items-center justify-between gap-[10px] border-b border-line-soft bg-tint2 px-[18px] py-[14px]">
            <div className="flex items-center gap-[9px]">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-brand font-display text-[11px] font-extrabold text-white">
                FR
              </span>
              <span className="font-display text-[13px] font-bold text-ink">
                {demoCard.title}
              </span>
            </div>
            <span className="rounded-full border border-brand-tintborder bg-brand-tint px-[10px] py-[5px] text-[11px] font-semibold text-brand">
              {demoCard.source}
            </span>
          </div>
          <div className="p-[18px]">
            <div className="mb-[7px] text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {demoCard.inquiryLabel}
            </div>
            <div className="rounded-xl bg-line-soft px-[15px] py-[13px] text-sm leading-[1.55] text-ink">
              {demoCard.inquiry}
            </div>

            <div className="mb-[7px] mt-4 flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F8F6A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {demoCard.replyLabel}
            </div>
            <div className="rounded-xl border border-brand-replyborder bg-brand-reply px-[15px] py-[14px] text-sm leading-[1.55] text-ink">
              {demoCard.reply}
              {/* What FirstReply pulled out of the inquiry — the answer, made scannable. */}
              <dl className="mt-3 overflow-hidden rounded-lg border border-brand-replyborder bg-white">
                {demoCard.outputs.map((o, i) => (
                  <div
                    key={o.label}
                    className={cn(
                      "flex items-center justify-between gap-3 px-[13px] py-[9px]",
                      i > 0 && "border-t border-line-soft",
                    )}
                  >
                    <dt className="text-xs text-ink-soft">{o.label}</dt>
                    <dd
                      className={cn(
                        "text-right text-[13px] font-semibold",
                        i === 0 ? "text-brand" : "text-ink",
                      )}
                    >
                      {o.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-[14px] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-[6px] rounded-full border border-brand-tintborder bg-brand-tint px-3 py-[6px] text-xs font-bold text-brand">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F8F6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {demoCard.statusPill}
              </span>
              <span className="text-xs text-ink-muted">{demoCard.statusNote}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
