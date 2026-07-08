import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardAvailabilityEdit } from "@/lib/dashboard/availability";
import { AvailabilityForm } from "../AvailabilityForm";
import { updateDashboardAvailabilityAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function DashboardAvailabilityEditPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  try {
    const client = await getCurrentClient();
    const rule = await getDashboardAvailabilityEdit(client.id, id);
    if (!rule) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/dashboard/availability"
            className="text-sm font-bold text-brand hover:text-brand-hover"
          >
            Atgal į užimtumą
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold uppercase text-brand">
                Užimtumo įrašas · {rule.serviceName}
              </div>
              <h1 className="mt-1 text-3xl font-extrabold text-ink">
                {rule.location ?? "Kiti regionai"}
              </h1>
            </div>
            {rule.expired ? (
              <span className="rounded-full border border-warn-border bg-warn-bg px-3 py-1 text-xs font-extrabold uppercase text-warn-text">
                Nebegalioja
              </span>
            ) : null}
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        {rule.expired ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm leading-relaxed text-warn-text">
            Šio įrašo galiojimas pasibaigęs — atnaujinkite terminą ir
            galiojimo datą, kad klientai vėl matytų aktualią informaciją.
          </div>
        ) : null}

        <AvailabilityForm
          action={updateDashboardAvailabilityAction}
          hiddenField={{ name: "ruleId", value: rule.id }}
          rule={rule}
          submitLabel="Išsaugoti"
        />
      </div>
    );
  } catch (error) {
    console.error("[dashboard-availability-edit] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}
