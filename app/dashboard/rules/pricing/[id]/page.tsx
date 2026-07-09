import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardPricingRuleEdit } from "@/lib/dashboard/rules";
import { updateDashboardPricingRuleAction } from "../../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function DashboardPricingRuleEditPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  try {
    const client = await getCurrentClient();
    const rule = await getDashboardPricingRuleEdit(client.id, id);
    if (!rule) {
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
              Kainodaros taisyklė · {rule.serviceName}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              {rule.name}
            </h1>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        <CalculationInfo rule={rule} />

        <form
          action={updateDashboardPricingRuleAction}
          className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
        >
          <input type="hidden" name="pricingRuleId" value={rule.id} />

          <section className="grid gap-4">
            <SectionHeading
              title="Pavadinimas ir kainos rėžiai"
              description="Rėžiai rodomi atsakyme klientui kaip orientacinė kaina."
            />
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Taisyklės pavadinimas
              <input
                name="name"
                required
                defaultValue={rule.name}
                className="rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Kaina nuo
                <input
                  name="priceMin"
                  inputMode="decimal"
                  defaultValue={rule.priceMin ?? ""}
                  placeholder="32"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Kaina iki
                <input
                  name="priceMax"
                  inputMode="decimal"
                  defaultValue={rule.priceMax ?? ""}
                  placeholder="75"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Vienetas
                <input
                  name="unit"
                  defaultValue={rule.unit ?? ""}
                  placeholder="€/m"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
            </div>
          </section>

          {rule.ruleType === "per_unit" ? (
            <section className="mt-7 grid gap-4 border-t border-line pt-6">
              <SectionHeading
                title="Skaičiavimo kaina"
                description="Bazinė vieneto kaina, nuo kurios skaičiuojama orientacinė suma."
              />
              <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
                Vieneto kaina
                <input
                  name="pricePerUnit"
                  inputMode="decimal"
                  defaultValue={rule.pricePerUnit ?? ""}
                  placeholder="38"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
            </section>
          ) : null}

          <section className="mt-7 grid gap-4 border-t border-line pt-6">
            <SectionHeading
              title="Siuntimas ir pastabos"
              description="Ar atsakymas su šia kaina gali išeiti be žmogaus peržiūros."
            />
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="autoSendAllowed"
                type="checkbox"
                defaultChecked={rule.autoSendAllowed}
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
                defaultChecked={rule.active}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Taisyklė aktyvi</span>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Pastaba prie kainos (disclaimer)
              <textarea
                name="disclaimerText"
                rows={3}
                defaultValue={rule.disclaimerText ?? ""}
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
              Išsaugoti
            </button>
          </div>
        </form>
      </div>
    );
  } catch (error) {
    console.error("[dashboard-pricing-edit] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function CalculationInfo({
  rule,
}: {
  rule: NonNullable<Awaited<ReturnType<typeof getDashboardPricingRuleEdit>>>;
}) {
  return (
    <section className="mb-5 rounded-lg border border-line bg-line-soft p-4">
      <h2 className="text-sm font-extrabold text-ink">Kaip skaičiuojama</h2>
      <dl className="mt-2 grid gap-1 text-sm text-ink-soft">
        <div>
          <dt className="inline font-semibold">Tipas: </dt>
          <dd className="inline">
            {rule.ruleType === "per_unit"
              ? "kaina už vienetą (kiekis × vieneto kaina)"
              : rule.ruleType === "range_estimate"
                ? "kainos rėžiai (nuo–iki)"
                : (rule.ruleType ?? "nenurodytas")}
          </dd>
        </div>
        {rule.requirementKey ? (
          <div>
            <dt className="inline font-semibold">Kiekis imamas iš: </dt>
            <dd className="inline">{rule.requirementKey}</dd>
          </div>
        ) : null}
        {rule.requires.length > 0 ? (
          <div>
            <dt className="inline font-semibold">Kainai reikia atsakymų: </dt>
            <dd className="inline">{rule.requires.join(", ")}</dd>
          </div>
        ) : null}
        {rule.modifierSummaries.length > 0 ? (
          <div>
            <dt className="inline font-semibold">Priedai: </dt>
            <dd className="inline">{rule.modifierSummaries.join("; ")}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Skaičiavimo struktūra keičiama tik kartu su FirstReply komanda, kad
        atsakymai liktų teisingi.
      </p>
    </section>
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
