import { Section, SectionHeading } from "@/components/ui/Section";
import { FAQ as FAQ_ITEMS } from "@/lib/constants";

export function FAQ() {
  return (
    <Section id="duk" className="bg-surface">
      <SectionHeading
        eyebrow="DUK"
        title="Dažniausiai užduodami klausimai"
        subtitle="Jei nerandate atsakymo — parašykite mums per demo formą, mielai atsakysime."
      />

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-slate-200 bg-white shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="flex-none text-ink-muted transition-transform group-open:rotate-180"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
