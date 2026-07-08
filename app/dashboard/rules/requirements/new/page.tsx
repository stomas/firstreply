import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getDashboardRuleCreateContext,
  REQUIREMENT_DIMENSIONS,
} from "@/lib/dashboard/rules";
import { createDashboardRequirementAction } from "../../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ service?: string; error?: string }>;
};

export default async function DashboardRequirementNewPage({
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
              Naujas klausimas · {context.serviceName}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              Ko paklausti kliento?
            </h1>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        <form
          action={createDashboardRequirementAction}
          className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
        >
          <input type="hidden" name="serviceId" value={context.serviceId} />

          <section className="grid gap-4">
            <SectionHeading
              title="Klausimas"
              description="Šis tekstas siunčiamas klientui, kai atsakyme trūksta informacijos."
            />
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Pavadinimas
              <input
                name="label"
                required
                placeholder="Pvz. Tvoros ilgis"
                className="rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Klausimo tekstas klientui
              <textarea
                name="question"
                required
                rows={3}
                placeholder="Kiek metrų tvoros reikėtų?"
                className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
              />
            </label>
          </section>

          <section className="mt-7 grid gap-4 border-t border-line pt-6">
            <SectionHeading
              title="Kaip atpažinti atsakymą tekste"
              description="Sistema pati suras atsakymą kliento žinutėje pagal temą ir matmenį."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Tema
                <select
                  name="subjectKey"
                  className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  {context.subjects.map((subject) => (
                    <option key={subject.subjectKey} value={subject.subjectKey}>
                      {subject.labelLt}
                    </option>
                  ))}
                  <option value="">Be temos (bet koks matavimas)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Matmuo
                <select
                  name="dimension"
                  required
                  className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
                >
                  {REQUIREMENT_DIMENSIONS.map((dimension) => (
                    <option key={dimension.value} value={dimension.value}>
                      {dimension.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
              Raktas (nebūtina)
              <input
                name="requirementKey"
                placeholder="Sudaromas iš pavadinimo"
                pattern="[a-zA-Z0-9_ąčęėįšųūžĄČĘĖĮŠŲŪŽ\s-]*"
                className="rounded-lg border border-line px-3 py-2 font-normal"
              />
              <span className="text-xs font-normal text-ink-muted">
                Naudojamas kainodaros taisyklėse, pvz. fence_length.
              </span>
            </label>
          </section>

          <section className="mt-7 grid gap-4 border-t border-line pt-6">
            <SectionHeading
              title="Svarba"
              description="Būtini klausimai stabdo automatinį atsakymą, kol negautas atsakymas."
            />
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="required"
                type="checkbox"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Būtinas — be jo kaina neskaičiuojama</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="affectsPrice"
                type="checkbox"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Atsakymas turi įtakos kainai</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="active"
                type="checkbox"
                defaultChecked
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Klausimas aktyvus</span>
            </label>
            <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
              Eiliškumas (mažesnis — klausiama anksčiau)
              <input
                name="priority"
                inputMode="numeric"
                defaultValue={100}
                className="rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
          </section>

          <section className="mt-7 grid gap-4 border-t border-line pt-6">
            <SectionHeading
              title="Priimamos reikšmės"
              description="Atsakymai už šių ribų atmetami ir klausiama dar kartą. Palikite tuščią, jei ribos nereikia."
            />
            <div className="grid max-w-md gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Nuo
                <input
                  name="validationMin"
                  inputMode="decimal"
                  placeholder="1"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Iki
                <input
                  name="validationMax"
                  inputMode="decimal"
                  placeholder="500"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
            </div>
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
              Sukurti klausimą
            </button>
          </div>
        </form>
      </div>
    );
  } catch (error) {
    console.error("[dashboard-requirement-new] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
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
