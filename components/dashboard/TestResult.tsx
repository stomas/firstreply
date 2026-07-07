import Link from "next/link";
import type { TestLeadResult } from "@/lib/leads/create-test-lead";
import type { LeadProcessingTrace } from "@/lib/leads/test-pipeline";

export function TestResult({ result }: { result: TestLeadResult }) {
  const evaluation = result.evaluation;

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-cardsoft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-ink-soft">
            Test result
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-ink">
            {result.responseStatus === "ready"
              ? "Atsakymas paruoštas"
              : "Reikalingas manual review"}
          </h2>
        </div>
        <Link
          href={`/dashboard/leads/${result.leadId}`}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-line-soft"
        >
          Atidaryti lead
        </Link>
      </div>

      {evaluation.manualReviewReasons.length > 0 ? (
        <div className="mt-4 rounded-lg border border-warn-border bg-warn-bg p-4">
          <div className="text-sm font-bold text-warn-text">
            Manual review priežastys
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warn-text">
            {evaluation.manualReviewReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.draftText ? (
        <div className="mt-4">
          <div className="text-sm font-bold text-ink">Draft</div>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-line-soft p-4 text-sm leading-relaxed text-ink">
            {evaluation.draftText}
          </pre>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Response type" value={evaluation.responseType} />
        <Metric
          label="Auto-send allowed"
          value={evaluation.autoSendAllowed ? "Taip" : "Ne"}
        />
        <Metric
          label="Pricing rules"
          value={String(evaluation.matchedPricingRules.length)}
        />
        <Metric
          label="Availability"
          value={evaluation.matchedAvailabilityRule?.earliestStartText || "—"}
        />
      </dl>

      {evaluation.missingRequirements.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm font-bold text-ink">Trūkstami laukai</div>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {evaluation.missingRequirements.map((requirement) => (
              <li key={requirement.key} className="p-3 text-sm">
                <div className="font-bold text-ink">{requirement.label}</div>
                <div className="text-ink-soft">{requirement.question}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TracePanel
        trace={result.trace}
        className="mt-5 border-t border-line pt-4"
      />
    </div>
  );
}

export function TracePanel({
  trace,
  className = "",
}: {
  trace: LeadProcessingTrace | null | undefined;
  className?: string;
}) {
  if (!trace?.stages.length) {
    return null;
  }

  return (
    <div className={className}>
      <div className="text-sm font-bold text-ink">Trace</div>
      <div className="mt-3 divide-y divide-line rounded-lg border border-line">
        {trace.stages.map((stage) => (
          <details key={stage.key} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-ink">{stage.label}</span>
                <span className="block truncate text-ink-soft">
                  {stage.summary}
                </span>
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-1 text-xs font-bold uppercase",
                  stage.status === "ok"
                    ? "bg-green-100 text-green-800"
                    : stage.status === "skipped"
                      ? "bg-line-soft text-ink-soft"
                      : "bg-warn-bg text-warn-text",
                ].join(" ")}
              >
                {stage.status}
              </span>
            </summary>
            <pre className="max-h-72 overflow-auto border-t border-line bg-line-soft p-3 text-xs leading-relaxed text-ink">
              {JSON.stringify(stage.data, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-line-soft p-3">
      <dt className="text-xs font-bold uppercase text-ink-soft">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
