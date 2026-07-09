import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getDashboardRules,
  summarizeDashboardRules,
  type DashboardPricingRuleRow,
  type DashboardRequirementRow,
  type DashboardRulesServiceGroup,
} from "@/lib/dashboard/rules";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ updated?: string; error?: string }>;
};

export default async function DashboardRulesPage({ searchParams }: PageProps) {
  try {
    const query = await searchParams;
    const client = await getCurrentClient();
    const groups = await getDashboardRules(client.id);
    const summary = summarizeDashboardRules(groups);

    return (
      <div className="mx-auto max-w-content">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-bold uppercase text-brand">
              Konfigūracija
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">Taisyklės</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Kainodara ir klausimai, pagal kuriuos sistema skaičiuoja
              orientacinę kainą ir žino, ko paklausti kliento, kai informacijos
              trūksta.
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
            Taisyklė išsaugota.
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
              <ServiceRulesCard key={group.serviceId} group={group} />
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[dashboard-rules] failed to load:", error);
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
    pricingRules: number;
    requirements: number;
    autoSendEnabled: number;
    inactive: number;
  };
}) {
  const items = [
    { label: "Kainodaros taisyklės", value: summary.pricingRules },
    { label: "Klausimai klientui", value: summary.requirements },
    { label: "Auto-send įjungtas", value: summary.autoSendEnabled },
    { label: "Neaktyvios", value: summary.inactive },
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

function ServiceRulesCard({ group }: { group: DashboardRulesServiceGroup }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{group.serviceName}</h2>
        {!group.serviceActive ? (
          <span className="rounded-full border border-line bg-line-soft px-3 py-1 text-xs font-extrabold uppercase text-ink-muted">
            Paslauga neaktyvi
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold uppercase text-ink-muted">
              Kainodara
            </h3>
            <AddLink
              href={`/dashboard/rules/pricing/new?service=${encodeURIComponent(group.serviceId)}`}
            >
              + Nauja taisyklė
            </AddLink>
          </div>
          {group.pricingRules.length === 0 ? (
            <SectionEmpty>
              Kainodaros taisyklių dar nėra — be jų kaina neskaičiuojama ir
              užklausa keliauja į peržiūrą.
            </SectionEmpty>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {group.pricingRules.map((rule) => (
                <PricingRuleRow key={rule.id} rule={rule} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold uppercase text-ink-muted">
              Klausimai klientui
            </h3>
            <AddLink
              href={`/dashboard/rules/requirements/new?service=${encodeURIComponent(group.serviceId)}`}
            >
              + Naujas klausimas
            </AddLink>
          </div>
          {group.requirements.length === 0 ? (
            <SectionEmpty>
              Klausimų dar nėra — sistema nežinos, kokios informacijos prašyti
              kainai paskaičiuoti.
            </SectionEmpty>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {group.requirements.map((requirement) => (
                <RequirementRow
                  key={requirement.id}
                  requirement={requirement}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

function PricingRuleRow({ rule }: { rule: DashboardPricingRuleRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div
          className={cn(
            "font-bold",
            rule.active ? "text-ink" : "text-ink-muted",
          )}
        >
          {rule.name}
        </div>
        <div className="mt-0.5 text-sm text-ink-soft">
          {formatPriceRange(rule)}
          {rule.pricePerUnit !== null
            ? ` · skaičiuojama nuo ${formatNumber(rule.pricePerUnit)} ${rule.unit ?? ""}`
            : ""}
        </div>
        {rule.modifierSummaries.length > 0 ? (
          <div className="mt-0.5 text-xs text-ink-muted">
            Priedai: {rule.modifierSummaries.join("; ")}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!rule.active ? <Badge tone="muted">Neaktyvi</Badge> : null}
        {rule.active && rule.autoSendAllowed ? (
          <Badge tone="brand">Auto-send</Badge>
        ) : null}
        <EditLink href={`/dashboard/rules/pricing/${rule.id}`} />
      </div>
    </li>
  );
}

function RequirementRow({
  requirement,
}: {
  requirement: DashboardRequirementRow;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div
          className={cn(
            "font-bold",
            requirement.active ? "text-ink" : "text-ink-muted",
          )}
        >
          {requirement.label}
        </div>
        <div className="mt-0.5 text-sm text-ink-soft">
          „{requirement.question}“
        </div>
        {requirement.validationMin !== null ||
        requirement.validationMax !== null ? (
          <div className="mt-0.5 text-xs text-ink-muted">
            Priimama reikšmė: {formatValidation(requirement)}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!requirement.active ? <Badge tone="muted">Neaktyvus</Badge> : null}
        {requirement.active ? (
          <Badge tone={requirement.required ? "brand" : "line"}>
            {requirement.required ? "Būtinas" : "Papildomas"}
          </Badge>
        ) : null}
        <EditLink href={`/dashboard/rules/requirements/${requirement.id}`} />
      </div>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "brand" | "muted" | "line";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-bold",
        tone === "brand" && "border-brand-tintborder bg-brand-tint text-brand",
        tone === "muted" && "border-line bg-line-soft text-ink-muted",
        tone === "line" && "border-line bg-white text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

function AddLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand-tint"
    >
      {children}
    </Link>
  );
}

function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-line-soft"
    >
      Redaguoti
    </Link>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-lg border border-dashed border-line bg-line-soft px-3 py-3 text-sm leading-relaxed text-ink-soft">
      {children}
    </p>
  );
}

function EmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center shadow-cardsoft">
      <h2 className="text-xl font-extrabold text-ink">Taisyklių dar nėra</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
        Kainodaros taisyklės ir klausimai suvedami kartu su paslaugomis diegimo
        metu. Kai jie atsiras, čia galėsite juos peržiūrėti ir redaguoti.
      </p>
    </section>
  );
}

function formatPriceRange(rule: DashboardPricingRuleRow): string {
  if (rule.priceMin === null && rule.priceMax === null) {
    return "Kainos rėžiai nenurodyti";
  }

  const min = rule.priceMin !== null ? formatNumber(rule.priceMin) : "—";
  const max = rule.priceMax !== null ? formatNumber(rule.priceMax) : "—";
  return `${min}–${max} ${rule.unit ?? ""}`.trim();
}

function formatValidation(requirement: DashboardRequirementRow): string {
  const min =
    requirement.validationMin !== null
      ? formatNumber(requirement.validationMin)
      : "—";
  const max =
    requirement.validationMax !== null
      ? formatNumber(requirement.validationMax)
      : "—";
  return `${min}–${max}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
