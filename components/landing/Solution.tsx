import { Section, SectionHeading } from "@/components/ui/Section";
import { SOLUTION } from "@/lib/constants";
import { cn } from "@/lib/utils";

const leadTones = {
  brand: "text-brand bg-brand-tint border-brand-tintborder",
  warn: "text-warn-text bg-warn-bg border-warn-border",
  neutral: "text-ink-soft bg-line-soft border-line",
} as const;

export function Solution() {
  return (
    <Section id="sprendimas" tone="tint">
      <SectionHeading
        eyebrow={SOLUTION.eyebrow}
        title={SOLUTION.title}
        subtitle={SOLUTION.intro}
        className="max-w-[720px]"
      />

      <div className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {SOLUTION.items.map((s) => (
          <div
            key={s.title}
            className="rounded-[20px] border border-line bg-white p-6 shadow-cardsoft"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-brand-tintborder bg-brand-tint">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0F8F6A"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="mt-[15px] text-[18px] font-bold tracking-[-0.01em] text-ink">
              {s.title}
            </h3>
            <p className="mt-[7px] text-sm leading-relaxed text-ink-soft">
              {s.text}
            </p>
          </div>
        ))}
      </div>

      {/* Product preview */}
      <div className="mx-auto mt-14 max-w-[680px] text-center">
        <h3 className="text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.02em] text-ink">
          {SOLUTION.preview.title}
        </h3>
        <p className="mx-auto mt-3 text-[15px] leading-relaxed text-ink-soft">
          {SOLUTION.preview.intro}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-[24px] border border-line bg-white shadow-lift">
        <div className="flex items-center gap-[10px] border-b border-line-soft bg-tint2 px-[22px] py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand font-display text-xs font-extrabold text-white">
            FR
          </span>
          <span className="font-display text-sm font-bold text-ink">
            {SOLUTION.preview.label}
          </span>
          <span className="ml-auto flex gap-[6px]">
            <span className="h-[9px] w-[9px] rounded-full bg-line" />
            <span className="h-[9px] w-[9px] rounded-full bg-line" />
            <span className="h-[9px] w-[9px] rounded-full bg-line" />
          </span>
        </div>

        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {/* Leads board */}
          <div className="border-b border-line-soft p-[clamp(20px,3vw,28px)] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Leadų lenta</h3>
              <span className="text-xs text-ink-muted">
                Šią savaitę · 4 naujos
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-[10px]">
              {SOLUTION.leads.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center gap-3 rounded-xl border border-line-faint bg-page px-[14px] py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {l.name}
                    </div>
                    <div className="truncate text-[12.5px] text-ink-muted">
                      {l.service}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex-none rounded-full border px-[9px] py-1 text-[11px] font-bold",
                      leadTones[l.tone],
                    )}
                  >
                    {l.status}
                  </span>
                  <span className="w-[78px] flex-none text-right text-[12.5px] font-semibold text-ink-soft">
                    {l.price}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Availability board */}
          <div className="p-[clamp(20px,3vw,28px)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink">Užimtumo lenta</h3>
              <span className="rounded-full border border-brand-tintborder bg-brand-tint px-[10px] py-1 text-xs font-bold text-brand">
                Galime nuo 3 sav.
              </span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {SOLUTION.weeks.map((w) => (
                <div
                  key={w.label}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-center",
                    w.free
                      ? "border-brand-tintborder bg-brand-reply"
                      : "border-warn-border2 bg-warn-bg2",
                  )}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                    {w.label}
                  </div>
                  <div
                    className={cn(
                      "mx-auto mt-2 flex h-[22px] w-[22px] items-center justify-center rounded-[7px]",
                      w.free ? "bg-brand-tint" : "bg-warn-bg",
                    )}
                  >
                    {w.free ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0F8F6A"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8A5A00"
                        strokeWidth="3"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <line x1="6" y1="12" x2="18" y2="12" />
                      </svg>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-[7px] text-[11.5px] font-semibold",
                      w.free ? "text-brand" : "text-warn-text",
                    )}
                  >
                    {w.state}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-ink-soft">
              Preliminarus „galime nuo“ langas skaičiuojamas pagal jūsų
              užimtumą. Konkrečią datą tvirtinate jūs.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
