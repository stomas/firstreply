import { Section, SectionHeading } from "@/components/ui/Section";
import { SAFETY } from "@/lib/constants";
import { cn } from "@/lib/utils";

type IconKey = (typeof SAFETY.items)[number]["icon"];

function SafetyIcon({ icon, stroke }: { icon: IconKey; stroke: string }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (icon) {
    case "check":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <line x1="10" y1="5" x2="10" y2="19" />
          <line x1="15" y1="5" x2="15" y2="19" />
        </svg>
      );
  }
}

export function Safety() {
  return (
    <Section id="sauga" maxWidth="1000px">
      <SectionHeading
        eyebrow={SAFETY.eyebrow}
        title={SAFETY.title}
        subtitle={SAFETY.intro}
      />

      <div className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {SAFETY.items.map((c) => {
          const brand = c.tone === "brand";
          return (
            <div
              key={c.title}
              className={cn(
                "rounded-[20px] border p-[26px]",
                brand
                  ? "border-brand-tintborder bg-brand-reply"
                  : "border-warn-border bg-warn-bg2",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[11px] border bg-white",
                  brand ? "border-brand-tintborder" : "border-warn-border",
                )}
              >
                <SafetyIcon icon={c.icon} stroke={brand ? "#0F8F6A" : "#8A5A00"} />
              </div>
              <h3 className="mt-[15px] text-[18px] font-bold tracking-[-0.01em] text-ink">
                {c.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {c.text}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
