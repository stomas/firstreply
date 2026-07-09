import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getDashboardAvailability,
  summarizeDashboardAvailability,
  type DashboardAvailabilityRow,
  type DashboardAvailabilityServiceGroup,
} from "@/lib/dashboard/availability";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ updated?: string; error?: string }>;
};

export default async function DashboardAvailabilityPage({
  searchParams,
}: PageProps) {
  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const groups = await getDashboardAvailability(client.id);
    const summary = summarizeDashboardAvailability(groups);

    return (
      <div className="mx-auto max-w-content">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-bold uppercase text-brand">
              Konfigūracija
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">Užimtumas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Kada ir kuriuose regionuose galite priimti naujus užsakymus. Šie
              terminai rodomi prie užklausų, kad atsakymai atitiktų realų
              užimtumą.
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
            Užimtumo įrašas išsaugotas.
          </div>
        ) : null}

        {query?.error ? (
          <div className="mt-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid gap-5">
            {groups.map((group) => (
              <ServiceAvailabilityCard key={group.serviceId} group={group} />
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[dashboard-availability] failed to load:", error);
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
    valid: number;
    autoSendEnabled: number;
    expired: number;
  };
}) {
  const items = [
    { label: "Įrašai", value: summary.total },
    { label: "Galiojantys", value: summary.valid },
    { label: "Auto-send leidžiamas", value: summary.autoSendEnabled },
    { label: "Nebegalioja", value: summary.expired },
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

function ServiceAvailabilityCard({
  group,
}: {
  group: DashboardAvailabilityServiceGroup;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold text-ink">
            {group.serviceName}
          </h2>
          {!group.serviceActive ? (
            <span className="rounded-full border border-line bg-line-soft px-3 py-1 text-xs font-extrabold uppercase text-ink-muted">
              Paslauga neaktyvi
            </span>
          ) : null}
        </div>
        <Link
          href={`/dashboard/availability/new?service=${encodeURIComponent(group.serviceId)}`}
          className="rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand-tint"
        >
          + Naujas įrašas
        </Link>
      </div>

      {group.rules.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line bg-line-soft px-3 py-3 text-sm leading-relaxed text-ink-soft">
          Užimtumo įrašų dar nėra — klientams nenurodomas orientacinis terminas
          šiai paslaugai.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {group.rules.map((rule) => (
            <AvailabilityRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}
    </article>
  );
}

function AvailabilityRow({ rule }: { rule: DashboardAvailabilityRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div
          className={cn(
            "font-bold",
            rule.expired ? "text-ink-muted" : "text-ink",
          )}
        >
          {rule.location ?? "Kiti regionai"}
        </div>
        {rule.earliestStartText ? (
          <div className="mt-0.5 text-sm text-ink-soft">
            {rule.earliestStartText}
          </div>
        ) : null}
        {rule.noteForCustomer ? (
          <div className="mt-0.5 text-xs text-ink-muted">
            {rule.noteForCustomer}
          </div>
        ) : null}
        {rule.validUntil ? (
          <div className="mt-0.5 text-xs text-ink-muted">
            Galioja iki {rule.validUntil}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rule.expired ? (
          <Badge tone="warn">Nebegalioja</Badge>
        ) : (
          <Badge
            tone={
              rule.status === "available"
                ? "brand"
                : rule.status === "limited"
                  ? "line"
                  : "muted"
            }
          >
            {rule.statusLabel}
          </Badge>
        )}
        {!rule.expired && rule.autoSendAllowed ? (
          <Badge tone="brand">Auto-send</Badge>
        ) : null}
        <Link
          href={`/dashboard/availability/${rule.id}`}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-line-soft"
        >
          Redaguoti
        </Link>
      </div>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "brand" | "muted" | "line" | "warn";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-bold",
        tone === "brand" && "border-brand-tintborder bg-brand-tint text-brand",
        tone === "muted" && "border-line bg-line-soft text-ink-muted",
        tone === "line" && "border-line bg-white text-ink-soft",
        tone === "warn" && "border-warn-border bg-warn-bg text-warn-text",
      )}
    >
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-cardsoft">
      <h2 className="text-xl font-extrabold text-ink">
        Užimtumo įrašų dar nėra
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Kai bus suvestos paslaugos, čia galėsite nurodyti, kuriuose regionuose
        ir kokiais terminais priimate užsakymus.
      </p>
    </section>
  );
}
