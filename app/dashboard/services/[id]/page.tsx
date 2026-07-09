import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { OfferingAnswerFields } from "@/components/dashboard/OfferingAnswerFields";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardServiceEdit } from "@/lib/dashboard/services";
import type { DashboardServiceEdit } from "@/lib/dashboard/services";
import { updateDashboardServiceAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function DashboardServiceEditPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  try {
    const client = await getCurrentClient();
    const service = await getDashboardServiceEdit(client.id, id);
    if (!service) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/dashboard/services"
            className="text-sm font-bold text-brand hover:text-brand-hover"
          >
            Atgal į paslaugas
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold uppercase text-brand">
                Paslaugos redagavimas
              </div>
              <h1 className="mt-1 text-3xl font-extrabold text-ink">
                {service.name}
              </h1>
            </div>
            <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-extrabold uppercase text-ink-soft">
              {service.card.statusLabel}
            </span>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        <SetupChecklist service={service} />
        <ServiceEditForm service={service} />
      </div>
    );
  } catch (error) {
    console.error("[dashboard-service-edit] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function SetupChecklist({ service }: { service: DashboardServiceEdit }) {
  const missing = service.card.missingSetup;
  if (missing.length === 0) {
    return (
      <section className="mb-5 rounded-lg border border-brand-tintborder bg-brand-tint p-4 text-sm font-semibold text-brand">
        Ši paslauga turi pagrindinį kontekstą atsakymams.
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-lg border border-warn-border bg-warn-bg p-4">
      <h2 className="text-sm font-extrabold text-warn-text">
        Reikia papildyti
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {missing.map((item) => (
          <span
            key={item}
            className="rounded-full border border-warn-border bg-white px-3 py-1 text-xs font-bold text-warn-text"
          >
            {item}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-warn-text">
        Šiame puslapyje patogiai sutvarkysite paslaugos aprašymą, raktažodžius
        ir atpažinimo temas. Kainodaros bei sprendimo klausimų taisyklės bus
        tvarkomos atskirame „Taisyklės“ puslapyje.
      </p>
    </section>
  );
}

function ServiceEditForm({ service }: { service: DashboardServiceEdit }) {
  const subjectRows =
    service.subjects.length > 0
      ? [...service.subjects, emptySubjectRow()]
      : [emptySubjectRow()];

  return (
    <form
      action={updateDashboardServiceAction}
      className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
    >
      <input type="hidden" name="serviceId" value={service.id} />

      <section className="grid gap-4">
        <SectionHeading
          title="Pagrindai"
          description="Tik tai, kas padeda atpažinti ir parodyti paslaugą klientui."
        />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Paslaugos pavadinimas
          <input
            name="name"
            required
            defaultValue={service.name}
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Trumpas pavadinimas klientui
          <input
            name="label"
            defaultValue={service.label ?? ""}
            placeholder="Pvz. Segmentinė tvora"
            className="rounded-lg border border-line px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold text-ink">
          <input
            name="active"
            type="checkbox"
            defaultChecked={service.active}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>Paslauga aktyvi ir gali būti naudojama atsakymuose</span>
        </label>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Atpažinimas"
          description="Žodžiai ir temos, pagal kuriuos sistema supranta, kad klientas kalba apie šią paslaugą."
        />
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Raktažodžiai
          <textarea
            name="keywords"
            rows={3}
            defaultValue={service.keywords.join(", ")}
            placeholder="tvora, tvoros, segmentinė"
            className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
          />
        </label>

        <div className="grid gap-3">
          <div className="text-sm font-extrabold text-ink">
            Atpažinimo temos
          </div>
          {subjectRows.map((subject, index) => (
            <div
              key={`${subject.subjectKey}-${index}`}
              className="grid gap-2 rounded-lg border border-line bg-line-soft p-3 sm:grid-cols-[minmax(130px,180px)_minmax(0,1fr)]"
            >
              <input
                type="hidden"
                name="subjectKey"
                value={subject.subjectKey}
              />
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Tema
                <input
                  name="subjectLabel"
                  defaultValue={subject.labelLt}
                  placeholder="Pvz. Tvora"
                  className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Sinonimai
                <input
                  name="subjectSynonyms"
                  defaultValue={subject.synonyms.join(", ")}
                  placeholder="tvora, tvoros, aptvėrimas"
                  className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-4 border-t border-line pt-6">
        <SectionHeading
          title="Atsakymas į klausimą „ar tai darote?“"
          description="Kai klientas paklausia „Ar darote segmentines tvoras?“ (neklausdamas kainos), sistema iš karto atsako šiuo tekstu. Jei jis tuščias — užklausa keliauja į rankinę peržiūrą."
        />
        <OfferingAnswerFields
          serviceId={service.id}
          serviceLabel={service.label || service.name}
          defaultDescription={service.offeringDescription ?? ""}
          defaultFollowup={service.offeringFollowup ?? ""}
        />
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        <Link
          href="/dashboard/services"
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

function emptySubjectRow() {
  return {
    subjectKey: "",
    labelLt: "",
    synonyms: [],
  };
}
