import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { TestInquiryForm } from "@/components/dashboard/TestInquiryForm";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import {
  getClientRuleCounts,
  getClientRules,
} from "@/lib/rules/get-client-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardTestPage() {
  try {
    const client = await getCurrentClient();
    const [rules, counts] = await Promise.all([
      getClientRules(client.id),
      getClientRuleCounts(client.id),
    ]);
    const hasRules =
      counts.pricingRules +
        counts.decisionRequirements +
        counts.availabilityRules >
      0;
    const canTest = counts.activeServices > 0 && hasRules;

    return (
      <main className="min-h-screen bg-page px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-content">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="text-sm font-bold text-brand hover:text-brand-hover"
              >
                Atgal į dashboard
              </Link>
              <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">
                Testavimo įrankis
              </h1>
            </div>
          </div>

          <RuleCountGrid counts={counts} />

          {!canTest ? (
            <div className="mt-5 rounded-lg border border-warn-border bg-warn-bg p-5 text-sm font-semibold text-warn-text">
              Šiam klientui dar nėra suvestų taisyklių. Testavimas negalimas,
              kol nėra bent vienos aktyvios paslaugos ir taisyklių.
            </div>
          ) : (
            <section className="mt-5">
              <TestInquiryForm services={rules.services} />
            </section>
          )}
        </div>
      </main>
    );
  } catch (error) {
    console.error("[dashboard-test] failed to load:", error);
    return (
      <main className="min-h-screen bg-page px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-content">
          <DashboardError message={getAppErrorMessage(error)} />
        </div>
      </main>
    );
  }
}

function RuleCountGrid({
  counts,
}: {
  counts: {
    activeServices: number;
    pricingRules: number;
    decisionRequirements: number;
    availabilityRules: number;
  };
}) {
  const items = [
    ["Active services", counts.activeServices],
    ["Pricing rules", counts.pricingRules],
    ["Decision requirements", counts.decisionRequirements],
    ["Availability rules", counts.availabilityRules],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg border border-line bg-white p-3 shadow-cardsoft sm:p-4"
        >
          <div className="text-xs font-bold uppercase text-ink-soft sm:text-sm sm:normal-case">
            {label}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}
