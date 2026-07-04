import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getLeadDetail, type LeadDetail } from "@/lib/leads/get-lead-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const client = await getCurrentClient();
    const lead = await getLeadDetail(client.id, id);

    return (
      <main className="min-h-screen bg-page px-6 py-8">
        <div className="mx-auto max-w-content">
          <div className="mb-6">
            <Link
              href="/dashboard"
              className="text-sm font-bold text-brand hover:text-brand-hover"
            >
              Atgal į dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold text-ink">
              Lead detail
            </h1>
          </div>

          <LeadOverview lead={lead} />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Originali užklausa">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {lead.originalMessage}
              </p>
            </Panel>
            <Panel title="Parse result JSON">
              <JsonBlock value={lead.parseResult} />
            </Panel>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <RulesPanel lead={lead} />
          </div>

          <section className="mt-5">
            <h2 className="mb-3 text-xl font-extrabold text-ink">Responses</h2>
            {lead.responses.length === 0 ? (
              <div className="rounded-lg border border-line bg-white p-5 text-sm text-ink-soft">
                Response dar nėra.
              </div>
            ) : (
              <div className="grid gap-4">
                {lead.responses.map((response) => (
                  <div
                    key={response.id}
                    className="rounded-lg border border-line bg-white p-5 shadow-cardsoft"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-bold text-ink">
                        {response.status} · {response.responseType}
                      </div>
                      <div className="text-sm text-ink-soft">
                        {formatDate(response.createdAt)}
                      </div>
                    </div>
                    {response.manualReviewReason ? (
                      <div className="mt-3 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm font-semibold text-warn-text">
                        {response.manualReviewReason}
                      </div>
                    ) : null}
                    {response.draftText ? (
                      <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-line-soft p-4 text-sm leading-relaxed">
                        {response.draftText}
                      </pre>
                    ) : null}
                    <div className="mt-3">
                      <div className="text-sm font-bold text-ink">
                        Decision JSON
                      </div>
                      <JsonBlock value={response.decisionJson} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  } catch (error) {
    console.error("[lead-detail] failed to load:", error);
    return (
      <main className="min-h-screen bg-page px-6 py-8">
        <div className="mx-auto max-w-content">
          <DashboardError message={getAppErrorMessage(error)} />
        </div>
      </main>
    );
  }
}

function LeadOverview({ lead }: { lead: LeadDetail }) {
  const items = [
    ["Source", lead.sourceType],
    ["Test", lead.isTest ? "Taip" : "Ne"],
    ["Status", lead.status],
    ["Klientas", lead.customerName || "Nežinomas klientas"],
    ["Email", lead.customerEmail || "—"],
    ["Telefonas", lead.customerPhone || "—"],
    ["Miestas", lead.city || "—"],
    ["Paslauga", lead.service?.name || "—"],
    ["Klausia kainos", lead.asksPrice ? "Taip" : "Ne"],
    ["Klausia termino", lead.asksAvailability ? "Taip" : "Ne"],
    ["Skubu", lead.isUrgent ? "Taip" : "Ne"],
    ["Attachments", lead.hasAttachments ? "Taip" : "Ne"],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg border border-line bg-white p-4 shadow-cardsoft"
        >
          <div className="text-xs font-bold uppercase text-ink-soft">
            {label}
          </div>
          <div className="mt-1 font-semibold text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}

function RulesPanel({ lead }: { lead: LeadDetail }) {
  return (
    <>
      <Panel title="Pricing rules">
        {lead.relatedRules.pricingRules.length === 0 ? (
          <EmptyRules />
        ) : (
          <ul className="divide-y divide-line">
            {lead.relatedRules.pricingRules.map((rule) => (
              <li key={rule.id} className="py-3 text-sm">
                <div className="font-bold">{rule.name}</div>
                <div className="text-ink-soft">
                  {formatPrice(rule.priceMin)}-{formatPrice(rule.priceMax)}{" "}
                  {rule.unit || ""}
                </div>
                <div className="text-ink-soft">
                  Auto-send: {rule.autoSendAllowed ? "Taip" : "Ne"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Decision requirements">
        {lead.relatedRules.decisionRequirements.length === 0 ? (
          <EmptyRules />
        ) : (
          <ul className="divide-y divide-line">
            {lead.relatedRules.decisionRequirements.map((requirement) => (
              <li key={requirement.id} className="py-3 text-sm">
                <div className="font-bold">{requirement.label}</div>
                <div className="text-ink-soft">
                  {requirement.questionTextIfMissing}
                </div>
                <div className="text-ink-soft">
                  Blocks auto-send: {requirement.blocksAutoSend ? "Taip" : "Ne"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Availability rules">
        {lead.relatedRules.availabilityRules.length === 0 ? (
          <EmptyRules />
        ) : (
          <ul className="divide-y divide-line">
            {lead.relatedRules.availabilityRules.map((rule) => (
              <li key={rule.id} className="py-3 text-sm">
                <div className="font-bold">{rule.location || "Visur"}</div>
                <div className="text-ink-soft">
                  {rule.status} · {rule.earliestStartText || "—"}
                </div>
                <div className="text-ink-soft">
                  Valid until:{" "}
                  {rule.validUntil ? formatDate(rule.validUntil) : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-lg border border-line bg-line-soft p-4 text-xs leading-relaxed text-ink">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyRules() {
  return <div className="text-sm text-ink-soft">Taisyklių nėra.</div>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(value: number | null): string {
  return value === null ? "—" : String(value);
}
