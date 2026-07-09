import { cn } from "@/lib/utils";

type SuperAdminServiceDetailsProps = {
  serviceName: string;
  serviceId: string;
  serviceActive: boolean;
  subjectsCount: number;
  requirementsCount: number;
  pricingRulesCount: number;
  unsupportedCount: number;
  brokenReferencesCount: number;
  children: React.ReactNode;
};

export function SuperAdminServiceDetails({
  serviceName,
  serviceId,
  serviceActive,
  subjectsCount,
  requirementsCount,
  pricingRulesCount,
  unsupportedCount,
  brokenReferencesCount,
  children,
}: SuperAdminServiceDetailsProps) {
  return (
    <details className="group rounded-lg border border-line bg-white shadow-cardsoft">
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 marker:hidden lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-extrabold text-ink">
              {serviceName}
            </h2>
            {!serviceActive ? (
              <span className="rounded-full border border-line bg-line-soft px-3 py-1 text-xs font-extrabold uppercase text-ink-muted">
                Neaktyvi
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-ink-soft">
            Service ID: <code>{serviceId}</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SummaryPill label="Temos" value={subjectsCount} />
          <SummaryPill label="Requirements" value={requirementsCount} />
          <SummaryPill label="Pricing" value={pricingRulesCount} />
          {unsupportedCount > 0 ? (
            <SummaryPill
              tone="warn"
              label="Unsupported"
              value={unsupportedCount}
            />
          ) : null}
          {brokenReferencesCount > 0 ? (
            <SummaryPill
              tone="warn"
              label="Broken refs"
              value={brokenReferencesCount}
            />
          ) : null}
          <span className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-extrabold uppercase text-ink-muted group-open:hidden">
            Atidaryti
          </span>
          <span className="hidden rounded-lg border border-line bg-line-soft px-3 py-1.5 text-xs font-extrabold uppercase text-ink-muted group-open:inline-flex">
            Suskleisti
          </span>
        </div>
      </summary>

      <div className="border-t border-line px-5 pb-5 pt-1">{children}</div>
    </details>
  );
}

function SummaryPill({
  label,
  value,
  tone = "line",
}: {
  label: string;
  value: number;
  tone?: "line" | "warn";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-bold",
        tone === "line" && "border-line bg-line-soft text-ink-soft",
        tone === "warn" && "border-warn-border bg-warn-bg text-warn-text",
      )}
    >
      {label}: {value}
    </span>
  );
}
