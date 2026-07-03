import { Section, SectionHeading } from "@/components/ui/Section";
import { SEGMENTS } from "@/lib/constants";

type IconKey = (typeof SEGMENTS.items)[number]["icon"];

function SegmentIcon({ icon }: { icon: IconKey }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#0F8F6A",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (icon) {
    case "terrace":
      return (
        <svg {...common}>
          <line x1="3" y1="8" x2="21" y2="8" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="16" x2="21" y2="16" />
          <line x1="3" y1="20" x2="21" y2="20" />
          <line x1="8" y1="8" x2="8" y2="20" />
          <line x1="16" y1="8" x2="16" y2="20" />
        </svg>
      );
    case "fence":
      return (
        <svg {...common}>
          <line x1="4" y1="10" x2="4" y2="20" />
          <line x1="9" y1="10" x2="9" y2="20" />
          <line x1="14" y1="10" x2="14" y2="20" />
          <line x1="19" y1="10" x2="19" y2="20" />
          <path d="M2 13h20" />
          <path d="M4 10l1.5-2M9 10l1.5-2M14 10l1.5-2M19 10l1.5-2" />
        </svg>
      );
    case "carport":
      return (
        <svg {...common}>
          <path d="M3 11l9-6 9 6" />
          <line x1="5" y1="11" x2="5" y2="20" />
          <line x1="19" y1="11" x2="19" y2="20" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      );
    case "gate":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="8" height="11" rx="1" />
          <rect x="13" y="8" width="8" height="11" rx="1" />
          <path d="M3 12l8 4M13 16l8-4" />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" />
        </svg>
      );
  }
}

export function Segments() {
  return (
    <Section id="kam-skirta">
      <SectionHeading eyebrow={SEGMENTS.eyebrow} title={SEGMENTS.title} />

      <div className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {SEGMENTS.items.map((g) => (
          <div
            key={g.name}
            className="flex flex-col gap-[14px] rounded-[20px] border border-line bg-white p-[26px] shadow-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-brand-tintborder bg-brand-tint">
                <SegmentIcon icon={g.icon} />
              </span>
              <h3 className="text-[19px] font-bold tracking-[-0.01em] text-ink">
                {g.name}
              </h3>
            </div>
            <div className="rounded-xl bg-line-soft px-[14px] py-3 text-sm italic leading-[1.5] text-ink">
              {g.question}
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">{g.help}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
