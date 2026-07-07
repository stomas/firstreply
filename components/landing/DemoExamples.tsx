import { Section, SectionHeading } from "@/components/ui/Section";
import { DEMOS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DemoExamples() {
  return (
    <Section id="pavyzdziai" tone="tint" maxWidth="1080px">
      <SectionHeading eyebrow={DEMOS.eyebrow} title={DEMOS.title} centered />

      <div className="mt-11 flex flex-col gap-6">
        {DEMOS.items.map((d) => {
          const review = d.status === "review";
          return (
            <article
              key={d.id}
              className="rounded-[22px] border border-line bg-white p-[clamp(20px,3vw,30px)] shadow-[0_6px_22px_-14px_rgba(16,32,27,0.2)]"
            >
              <div className="flex flex-wrap items-center gap-[10px]">
                <span className="text-[13px] font-bold text-ink">
                  {d.label}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-3 py-[5px] text-xs font-bold",
                    review
                      ? "border-warn-border bg-warn-bg text-warn-text"
                      : "border-brand-tintborder bg-brand-tint text-brand",
                  )}
                >
                  {d.statusLabel}
                </span>
              </div>

              <div className="mt-[18px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    Pavyzdinė užklausa
                  </div>
                  <div className="rounded-[14px] bg-line-soft px-[17px] py-[15px] text-[14.5px] leading-[1.55] text-ink">
                    {d.inquiry}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                    Pavyzdinis FirstReply atsakymas
                  </div>
                  <div
                    className={cn(
                      "rounded-[14px] border px-[17px] py-[15px] text-[14.5px] leading-[1.55] text-ink",
                      review
                        ? "border-warn-border2 bg-warn-bg2"
                        : "border-brand-replyborder bg-brand-reply",
                    )}
                  >
                    {d.reply}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-brand-tintborder bg-brand-tint px-[10px] py-[5px] text-xs font-semibold text-brand">
                        {d.price}
                      </span>
                      <span className="rounded-lg border border-line bg-white px-[10px] py-[5px] text-xs font-semibold text-ink-soft">
                        {d.availability}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {d.note ? (
                <div className="mt-4 flex items-start gap-[10px] rounded-xl border border-warn-border bg-warn-bg px-[15px] py-[13px]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A5A00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-px flex-none"
                    aria-hidden
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-sm leading-[1.5] text-warn-text">
                    {d.note}
                  </span>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Section>
  );
}
