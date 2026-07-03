import { Button } from "@/components/ui/Button";

const FEATURES = [
  "Web forma + Paslaugos.lt",
  "Iki 2 paslaugų",
  "Neribotos taisyklės įtrauktoms paslaugoms",
  "1 follow-up",
  "Užimtumo lenta",
];

export function PricingTeaser() {
  return (
    <section className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-brand-200 bg-white p-6 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                Starter
              </span>
              <span className="text-xl font-bold text-ink sm:text-2xl">
                €149 setup + €99/mėn.
              </span>
            </p>
            <p className="mt-2 text-sm font-medium text-brand-800">
              Iki 50 užklausų per mėnesį įskaičiuota. Papildomos užklausos —
              €1/vnt.
            </p>
          </div>

          <Button href="#demo" className="w-full shrink-0 sm:w-auto">
            Gauti demo
          </Button>
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm text-ink-soft">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-1.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="flex-none text-brand-600"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
