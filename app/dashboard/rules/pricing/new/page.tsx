import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardRuleCreateContext } from "@/lib/dashboard/rules";
import { createDashboardPricingRuleAction } from "../../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ service?: string; error?: string }>;
};

export default async function DashboardPricingRuleNewPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const serviceId = query?.service?.trim();
  if (!serviceId) {
    notFound();
  }

  try {
    const client = await getCurrentClient();
    const context = await getDashboardRuleCreateContext(client.id, serviceId);
    if (!context) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/dashboard/rules"
            className="text-sm font-bold text-brand hover:text-brand-hover"
          >
            Atgal į taisykles
          </Link>
          <div className="mt-3">
            <div className="text-sm font-bold uppercase text-brand">
              Nauja kainodaros taisyklė · {context.serviceName}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              Kaip skaičiuoti kainą?
            </h1>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        {context.requirements.length === 0 ? (
          <NeedsQuestionFirst serviceId={context.serviceId} />
        ) : (
          <PricingCreateForm context={context} />
        )}
      </div>
    );
  } catch (error) {
    console.error("[dashboard-pricing-new] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function NeedsQuestionFirst({ serviceId }: { serviceId: string }) {
  return (
    <section className="rounded-lg border border-warn-border bg-warn-bg p-5">
      <h2 className="text-base font-extrabold text-warn-text">
        Pirmiausia reikia klausimo
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-warn-text">
        Kaina skaičiuojama iš kliento atsakymo (pvz. tvoros ilgio), todėl šiai
        paslaugai pirmiausia sukurkite bent vieną klausimą.
      </p>
      <Link
        href={`/dashboard/rules/requirements/new?service=${encodeURIComponent(serviceId)}`}
        className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover"
      >
        Sukurti klausimą
      </Link>
    </section>
  );
}

function PricingCreateForm({
  context,
}: {
  context: NonNullable<
    Awaited<ReturnType<typeof getDashboardRuleCreateContext>>
  >;
}) {
  return (
    <form
      action={createDashboardPricingRuleAction}
      className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
    >
      <input type="hidden" name="serviceId" value={context.serviceId} />

      <section className="grid gap-4">
        <SectionHeading
          title="Pavadinimas"
          description="Vidinis pavadinimas, matomas tik jums."
        />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Taisyklės pavadinimas
          <input
            name="name"
            required
            placeholder="Pvz. Segmentinė tvora pagal metrą"
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Skaičiavimas"
          description="Iš ko ir kaip skaičiuojama orientacinė kaina."
        />
        <div className="grid gap-2">
          <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm font-semibold text-ink">
            <input
              type="radio"
              name="ruleType"
              value="per_unit"
              defaultChecked
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              Kiekis × vieneto kaina
              <span className="block font-normal text-ink-soft">
                Kaina paskaičiuojama automatiškai, pvz. 45 m × 38 €/m.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm font-semibold text-ink">
            <input
              type="radio"
              name="ruleType"
              value="range_estimate"
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              Tik kainos rėžiai
              <span className="block font-normal text-ink-soft">
                Klientui rodomi rėžiai „nuo–iki“, galutinę kainą patvirtinate
                patys.
              </span>
            </span>
          </label>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-ink">
          Kiekis imamas iš klausimo
          <select
            name="quantityKey"
            required
            className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
          >
            {context.requirements.map((requirement) => (
              <option
                key={requirement.requirementKey}
                value={requirement.requirementKey}
              >
                {requirement.label} ({requirement.requirementKey})
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Vieneto kaina (jei „kiekis × kaina“)
            <input
              name="pricePerUnit"
              inputMode="decimal"
              placeholder="38"
              className="rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Kiekio vienetas
            <input
              name="quantityUnit"
              defaultValue="m"
              className="rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">
            Kainai reikia atsakymų
          </legend>
          <p className="text-xs text-ink-muted">
            Kaina siunčiama tik tada, kai gauti visi pažymėti atsakymai.
            Kiekio klausimas įtraukiamas visada.
          </p>
          {context.requirements.map((requirement) => (
            <label
              key={requirement.requirementKey}
              className="flex items-start gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                name="requires"
                value={requirement.requirementKey}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>{requirement.label}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Kainos rėžiai klientui"
          description="Rodomi atsakyme kaip orientacinė kaina."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Kaina nuo
            <input
              name="priceMin"
              inputMode="decimal"
              placeholder="32"
              className="rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Kaina iki
            <input
              name="priceMax"
              inputMode="decimal"
              placeholder="75"
              className="rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Vienetas
            <input
              name="unit"
              placeholder="€/m"
              className="rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
        </div>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Siuntimas ir pastabos"
          description="Ar atsakymas su šia kaina gali išeiti be žmogaus peržiūros."
        />
        <label className="flex items-start gap-2 text-sm font-semibold text-ink">
          <input
            name="autoSendAllowed"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            Leisti auto-send — atsakymas gali būti išsiųstas automatiškai
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold text-ink">
          <input
            name="active"
            type="checkbox"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>Taisyklė aktyvi</span>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Pastaba prie kainos (disclaimer)
          <textarea
            name="disclaimerText"
            rows={3}
            placeholder="Orientacinė kaina tikslinama apžiūrėjus objektą..."
            className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
          />
        </label>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        <Link
          href="/dashboard/rules"
          className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft hover:bg-line-soft"
        >
          Atšaukti
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover"
        >
          Sukurti taisyklę
        </button>
      </div>
    </form>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
    </div>
  );
}
