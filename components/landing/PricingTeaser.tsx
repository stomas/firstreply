import { PRICING } from "@/lib/constants";

const CHIPS = [
  "Web forma + Paslaugos.lt",
  "Iki 2 paslaugų tipų",
  "Neribotos taisyklės",
  "1 follow-up",
  "Užimtumo lenta",
];

export function PricingTeaser() {
  return (
    <section className="px-6 pb-[clamp(24px,4vw,40px)]">
      <div className="mx-auto max-w-[1020px] overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_12px_40px_-24px_rgba(16,32,27,0.28)]">
        <div className="h-1 bg-brand" />
        <div className="flex flex-wrap items-center justify-between gap-6 p-[clamp(22px,4vw,32px)]">
          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-brand">
                {PRICING.starter.name}
              </span>
              <span className="font-display text-[clamp(24px,3.5vw,30px)] font-extrabold tracking-[-0.02em] text-ink">
                €149 setup + €99/mėn.
              </span>
            </div>
            <p className="mt-2 text-[15px] text-ink-soft">
              Iki 50 užklausų per mėnesį įskaičiuota, papildomos — €1/vnt.
              Galutinį pasiūlymą pateikiame įvertinę jūsų situaciją.
            </p>
            <div className="mt-[14px] flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-lg bg-line-soft px-[11px] py-[6px] text-[13px] text-ink-soft"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <a
            href="#cta"
            className="flex-none rounded-[14px] bg-brand px-[30px] py-[15px] text-base font-bold text-white shadow-cta transition-colors hover:bg-brand-hover"
          >
            Gauti pasiūlymą
          </a>
        </div>
      </div>
    </section>
  );
}
