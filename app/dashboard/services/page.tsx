import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getDashboardServices,
  summarizeDashboardServiceCards,
  type DashboardServiceCard,
} from "@/lib/dashboard/services";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ updated?: string }>;
};

export default async function DashboardServicesPage({
  searchParams,
}: PageProps) {
  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const services = await getDashboardServices(client.id);
    const summary = summarizeDashboardServiceCards(services);

    return (
      <div className="mx-auto max-w-content">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-bold uppercase text-brand">
              Konfigūracija
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">Paslaugos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Čia matosi, ar kiekviena paslauga turi pakankamai konteksto
              atsakymams: atpažinimą, kainodarą, klausimus ir trumpą aprašymą
              klientui.
            </p>
          </div>
          <Link
            href="/dashboard/test"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover"
          >
            Testuoti atsakymą
          </Link>
        </header>

        <SummaryGrid summary={summary} />

        {query?.updated ? (
          <div className="mt-4 rounded-lg border border-brand-tintborder bg-brand-tint px-4 py-3 text-sm font-semibold text-brand">
            Paslauga išsaugota.
          </div>
        ) : null}

        {services.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </section>
        )}
      </div>
    );
  } catch (error) {
    console.error("[dashboard-services] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function SummaryGrid({
  summary,
}: {
  summary: {
    total: number;
    active: number;
    ready: number;
    needsSetup: number;
  };
}) {
  const items = [
    { label: "Iš viso", value: summary.total },
    { label: "Aktyvios", value: summary.active },
    { label: "Paruoštos", value: summary.ready },
    { label: "Reikia papildyti", value: summary.needsSetup },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-line bg-white p-4 shadow-cardsoft"
        >
          <div className="text-sm font-semibold text-ink-soft">
            {item.label}
          </div>
          <div className="mt-1 text-3xl font-extrabold text-ink">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceCard({ service }: { service: DashboardServiceCard }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink">{service.name}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {service.label || "Vidinis pavadinimas naudojamas ir klientui"}
          </p>
        </div>
        <StatusBadge status={service.status} label={service.statusLabel} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Kainodara" value={service.pricingRuleCount} />
        <Metric label="Klausimai" value={service.requiredQuestionCount} />
        <Metric label="Užimtumas" value={service.availabilityRuleCount} />
      </div>

      <div className="mt-5 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <InfoBlock title="Atpažinimas">
          {service.subjectLabels.length > 0 ? (
            <TagList items={service.subjectLabels} />
          ) : (
            <MutedText>Temos dar nesuvestos.</MutedText>
          )}
          <div className="mt-3 text-xs text-ink-muted">
            {service.keywordCount > 0
              ? `${service.keywordCount} raktažodžiai: ${service.keywordsPreview.join(", ")}`
              : "Raktažodžių dar nėra."}
          </div>
        </InfoBlock>

        <InfoBlock title="Klientui">
          {service.hasOfferingDescription ? (
            <MutedText>Paslaugos aprašymas paruoštas.</MutedText>
          ) : (
            <MutedText>Trūksta trumpo aprašymo pasiūlos klausimams.</MutedText>
          )}
          <div className="mt-3 text-xs text-ink-muted">
            {service.optionalQuestionCount > 0
              ? `${service.optionalQuestionCount} papildomi klausimai`
              : "Tik būtini klausimai arba klausimų dar nėra."}
          </div>
        </InfoBlock>
      </div>

      {service.missingSetup.length > 0 && service.status !== "inactive" ? (
        <div className="mt-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
          Papildyti: {service.missingSetup.join(", ")}.
        </div>
      ) : null}

      <div className="mt-5 flex justify-end border-t border-line pt-4">
        <Link
          href={`/dashboard/services/${service.id}`}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-bold",
            service.status === "needs_setup"
              ? "bg-brand text-white shadow-cta hover:bg-brand-hover"
              : "border border-line bg-white text-ink-soft hover:bg-line-soft",
          )}
        >
          {service.status === "needs_setup" ? "Papildyti" : "Redaguoti"}
        </Link>
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: DashboardServiceCard["status"];
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-extrabold uppercase",
        status === "ready" &&
          "border-brand-tintborder bg-brand-tint text-brand",
        status === "needs_setup" &&
          "border-warn-border bg-warn-bg text-warn-text",
        status === "inactive" && "border-line bg-line-soft text-ink-muted",
      )}
    >
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-line-soft px-3 py-3">
      <div className="text-xs font-bold uppercase text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-ink">{value}</div>
    </div>
  );
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-extrabold text-ink">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-brand-reply px-3 py-1 text-xs font-bold text-brand"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-soft">{children}</p>;
}

function EmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-cardsoft">
      <h2 className="text-xl font-extrabold text-ink">Paslaugų dar nėra</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Kai bus suvestos paslaugos, čia matysite jų pasiruošimą atsakymams ir
        kas dar trukdo saugiai generuoti pirmą atsakymą klientui.
      </p>
    </section>
  );
}
