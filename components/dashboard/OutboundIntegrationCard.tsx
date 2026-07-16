"use client";

import { useState, type FormEvent } from "react";
import {
  refreshOutboundIntegrationAction,
  setDefaultOutboundIntegrationAction,
  setOutboundIntegrationStatusAction,
} from "@/app/dashboard/integrations/actions";
import { CopyValueButton } from "@/components/dashboard/CopyValueButton";
import type { OutboundIntegrationDashboardItem } from "@/lib/outbound/integrations";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function OutboundIntegrationCard({
  integration,
}: {
  integration: OutboundIntegrationDashboardItem;
}) {
  const [current, setCurrent] = useState(integration);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const active = current.status === "ACTIVE";

  async function refreshDns(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking) return;

    const formData = new FormData(event.currentTarget);
    setChecking(true);
    setFeedback(null);
    try {
      const result = await refreshOutboundIntegrationAction(formData);
      if (result.ok) {
        setCurrent(result.integration);
        setFeedback({ kind: "success", message: result.message });
      } else {
        setFeedback({ kind: "error", message: result.message });
      }
    } catch (error) {
      console.error("[outbound-integration-refresh] request failed", error);
      setFeedback({
        kind: "error",
        message: "Domeno būsenos atnaujinti nepavyko. Pabandykite dar kartą.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-ink">{current.name}</h3>
            <span className="rounded-full bg-line-soft px-2.5 py-1 text-xs font-extrabold text-ink-soft">
              {outboundStatusLabel(current.status)}
            </span>
            {current.isDefault ? (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-extrabold text-brand">
                Numatytasis
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {current.fromName} &lt;{current.fromEmail}&gt; · Reply-To{" "}
            {current.replyToEmail} · {current.dispatchCount} siuntimai
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={refreshDns}>
            <input type="hidden" name="integrationId" value={current.id} />
            <button
              type="submit"
              disabled={checking}
              className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand hover:bg-brand-tint disabled:cursor-wait disabled:opacity-60"
            >
              {checking ? "Tikrinama…" : "Tikrinti DNS"}
            </button>
          </form>
          <form action={setOutboundIntegrationStatusAction}>
            <input type="hidden" name="integrationId" value={current.id} />
            <input
              type="hidden"
              name="enabled"
              value={active ? "false" : "true"}
            />
            <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
              {active ? "Išjungti" : "Įjungti"}
            </button>
          </form>
          {active && !current.isDefault ? (
            <form action={setDefaultOutboundIntegrationAction}>
              <input type="hidden" name="integrationId" value={current.id} />
              <button className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:bg-line-soft">
                Naudoti pagal nutylėjimą
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Domeno būsena: {domainStatusLabel(current.providerStatus)} · Domenas:{" "}
        {current.domain}
      </p>
      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`mt-3 rounded-lg border p-3 text-sm ${
            feedback.kind === "error"
              ? "border-warn-border bg-warn-bg text-warn-text"
              : "border-brand-tintborder bg-brand-tint text-brand"
          }`}
        >
          {feedback.message}
        </p>
      ) : current.lastError ? (
        <p className="mt-3 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm text-warn-text">
          {current.lastError}
        </p>
      ) : null}
      {current.dnsRecords.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="p-2">Tipas</th>
                <th className="p-2">Pavadinimas</th>
                <th className="p-2">Reikšmė</th>
                <th className="p-2">Prioritetas</th>
                <th className="p-2">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {current.dnsRecords.map((record, index) => (
                <tr
                  key={`${record.record}-${record.name}-${index}`}
                  className="border-b border-line-soft"
                >
                  <td className="p-2 font-bold">{record.type}</td>
                  <td className="p-2">
                    <code className="break-all">{record.name}</code>
                  </td>
                  <td className="p-2">
                    <div className="flex min-w-60 items-center gap-2">
                      <code className="break-all">{record.value}</code>
                      <CopyValueButton
                        value={record.value}
                        label={`${record.record} DNS reikšmę`}
                      />
                    </div>
                  </td>
                  <td className="p-2">{record.priority ?? "—"}</td>
                  <td className="p-2">{record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

function outboundStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Aktyvi";
  if (status === "DISABLED") return "Išjungta";
  if (status === "FAILED") return "DNS klaida";
  return "Laukiama DNS";
}

function domainStatusLabel(status: string): string {
  if (status === "verified") return "Patvirtintas";
  if (status === "failed" || status === "partially_failed") return "Klaida";
  if (status === "not_started") return "Nepradėtas tikrinimas";
  if (status === "partially_verified") return "Patvirtintas iš dalies";
  if (status === "temporary_failure") return "Laikina tikrinimo klaida";
  return "Tikrinamas";
}
