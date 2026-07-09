import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardRequirementEdit } from "@/lib/dashboard/rules";
import {
  deleteDashboardRequirementAction,
  updateDashboardRequirementAction,
} from "../../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function DashboardRequirementEditPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  try {
    const client = await getCurrentClient();
    const requirement = await getDashboardRequirementEdit(client.id, id);
    if (!requirement) {
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
              Klausimas klientui · {requirement.serviceName}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              {requirement.label}
            </h1>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        <section className="mb-5 rounded-lg border border-line bg-line-soft p-4">
          <h2 className="text-sm font-extrabold text-ink">
            Ką sistema atpažįsta
          </h2>
          <dl className="mt-2 grid gap-1 text-sm text-ink-soft">
            <div>
              <dt className="inline font-semibold">Raktas: </dt>
              <dd className="inline">{requirement.requirementKey}</dd>
            </div>
            {requirement.expectedFactSummary ? (
              <div>
                <dt className="inline font-semibold">Laukiamas faktas: </dt>
                <dd className="inline">{requirement.expectedFactSummary}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Atpažinimo struktūra keičiama tik kartu su FirstReply komanda — nuo
            jos priklauso, kaip tekste randamas atsakymas.
          </p>
        </section>

        <form
          action={updateDashboardRequirementAction}
          className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
        >
          <input type="hidden" name="requirementId" value={requirement.id} />

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
                defaultValue={requirement.label}
                className="rounded-lg border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Klausimo tekstas klientui
              <textarea
                name="question"
                required
                rows={3}
                defaultValue={requirement.question}
                placeholder="Kiek metrų tvoros reikėtų?"
                className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
              />
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
                defaultChecked={requirement.required}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Būtinas — be jo kaina neskaičiuojama</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="affectsPrice"
                type="checkbox"
                defaultChecked={requirement.affectsPrice}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Atsakymas turi įtakos kainai</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-ink">
              <input
                name="active"
                type="checkbox"
                defaultChecked={requirement.active}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>Klausimas aktyvus</span>
            </label>
            <label className="grid max-w-xs gap-1 text-sm font-semibold text-ink">
              Eiliškumas (mažesnis — klausiama anksčiau)
              <input
                name="priority"
                inputMode="numeric"
                defaultValue={requirement.priority}
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
                  defaultValue={requirement.validationMin ?? ""}
                  placeholder="1"
                  className="rounded-lg border border-line px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Iki
                <input
                  name="validationMax"
                  inputMode="decimal"
                  defaultValue={requirement.validationMax ?? ""}
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
              Išsaugoti
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-cardsoft">
          <p className="text-sm leading-relaxed text-ink-soft">
            Ištrynimas negrįžtamas. Jei klausimą naudoja kainodaros taisyklė,
            sistema neleis jo ištrinti. Laikinam išjungimui nuimkite „Klausimas
            aktyvus“.
          </p>
          <DeleteButton
            action={deleteDashboardRequirementAction.bind(null, requirement.id)}
            confirmText={`Ištrinti klausimą „${requirement.label}“? Veiksmas negrįžtamas.`}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[dashboard-requirement-edit] failed to load:", error);
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
