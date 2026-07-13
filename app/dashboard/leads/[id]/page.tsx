import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getLeadDetail, type LeadDetail } from "@/lib/leads/get-lead-detail";
import {
  closeConversationAction,
  markAnsweredExternallyAction,
  reopenConversationAction,
} from "./actions";

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
      <div className="mx-auto max-w-content">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm font-bold text-brand hover:text-brand-hover"
          >
            Atgal į dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold text-ink">Lead detail</h1>
        </div>

        <LeadOverview lead={lead} />
        {lead.conversation ? (
          <ConversationPanel lead={lead} />
        ) : (
          <div className="mt-5">
            <Panel title="Originali užklausa">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {lead.originalMessage}
              </p>
            </Panel>
          </div>
        )}

        <div className="mt-5">
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
              {lead.responses.map((response, index) => (
                <div
                  key={response.id}
                  className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-cardsoft"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-bold text-ink">
                      Revizija {lead.responses.length - index} ·{" "}
                      {response.status}
                      {" · "}
                      {response.responseType}
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
    );
  } catch (error) {
    console.error("[lead-detail] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}

function ConversationPanel({ lead }: { lead: LeadDetail }) {
  const conversation = lead.conversation;
  if (!conversation) {
    return null;
  }
  const timeline = [
    ...conversation.messages.map((message) => ({
      kind: "message" as const,
      id: message.id,
      createdAt: message.receivedAt,
      message,
    })),
    ...conversation.activities.map((activity) => ({
      kind: "activity" as const,
      id: activity.id,
      createdAt: activity.createdAt,
      activity,
    })),
  ].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return (
    <section className="mt-5 rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold text-ink">Pokalbis</h2>
            <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-extrabold text-brand">
              {conversationStatusLabel(conversation.status)}
            </span>
            <span className="rounded-full bg-line-soft px-3 py-1 text-xs font-extrabold text-ink-soft">
              {conversation.sourceName}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Tikri inbound laiškai ir audituoti rankiniai veiksmai. „Atsakyta
            kitur“ nesukuria fiktyvaus išsiųsto laiško.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conversation.status === "CLOSED" ? (
            <form action={reopenConversationAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand hover:bg-brand-tint">
                Atidaryti iš naujo
              </button>
            </form>
          ) : (
            <form action={closeConversationAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
                Uždaryti
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {timeline.map((item) =>
          item.kind === "message" ? (
            <article
              key={item.id}
              className="rounded-lg border border-line bg-line-soft p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span className="font-bold text-ink-soft">
                  {conversation.sourceType === "PASLAUGOS_LT"
                    ? `Persiuntė: ${
                        item.message.senderName ||
                        item.message.senderEmail ||
                        "nežinomas siuntėjas"
                      }`
                    : item.message.senderName ||
                      item.message.senderEmail ||
                      "Nežinomas siuntėjas"}
                </span>
                <span>{formatDate(item.message.receivedAt)}</span>
              </div>
              {item.message.subject ? (
                <div className="mt-2 text-sm font-bold text-ink">
                  {item.message.subject}
                </div>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {item.message.text}
              </p>
              {item.message.hasAttachments ? (
                <div className="mt-3 text-xs font-bold text-warn-text">
                  Yra neanalizuotų priedų — būtina rankinė peržiūra.
                </div>
              ) : null}
            </article>
          ) : (
            <div
              key={item.id}
              className="rounded-lg border border-brand-tintborder bg-brand-tint px-4 py-3 text-sm text-brand"
            >
              <div className="font-bold">
                {activityLabel(item.activity.type)} ·{" "}
                {item.activity.actorEmail || "Sistema"}
              </div>
              <div className="mt-1 text-xs">
                {formatDate(item.activity.createdAt)}
              </div>
              {item.activity.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {item.activity.note}
                </p>
              ) : null}
            </div>
          ),
        )}
      </div>

      {conversation.status !== "CLOSED" ? (
        <form
          action={markAnsweredExternallyAction}
          className="mt-5 rounded-lg border border-line p-4"
        >
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="text-sm font-bold text-ink">
            Pažymėti, kad atsakyta kitur
            <textarea
              name="note"
              maxLength={500}
              rows={2}
              placeholder="Pasirenkama pastaba, pvz. atsakyta telefonu"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <button className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover">
            Pažymėti atsakytą
          </button>
        </form>
      ) : (
        <p className="mt-5 rounded-lg border border-line bg-line-soft px-4 py-3 text-sm text-ink-soft">
          Norėdami fiksuoti naują veiksmą, pirmiausia atidarykite pokalbį iš
          naujo.
        </p>
      )}
    </section>
  );
}

function activityLabel(type: string): string {
  if (type === "ANSWERED_EXTERNALLY") return "Atsakyta kitur";
  if (type === "REOPENED") return "Pokalbis atidarytas iš naujo";
  if (type === "CLOSED") return "Pokalbis uždarytas";
  return type;
}

function conversationStatusLabel(status: string): string {
  if (status === "NEEDS_REPLY") return "Reikia atsakyti";
  if (status === "WAITING_CUSTOMER") return "Laukiama kliento";
  if (status === "MANUAL_REVIEW") return "Reikia peržiūros";
  if (status === "CLOSED") return "Uždarytas";
  return status;
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
    <section className="min-w-0 rounded-lg border border-line bg-white p-5 shadow-cardsoft">
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
    timeZone: "Europe/Vilnius",
  }).format(new Date(value));
}

function formatPrice(value: number | null): string {
  return value === null ? "—" : String(value);
}
