import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { assertDatabaseConfigured, prisma } from "@/lib/db";
import { AvailabilityForm } from "../AvailabilityForm";
import { createDashboardAvailabilityAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ service?: string; error?: string }>;
};

export default async function DashboardAvailabilityNewPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const serviceId = query?.service?.trim();
  if (!serviceId) {
    notFound();
  }

  try {
    assertDatabaseConfigured();
    const client = await getCurrentClient();
    const service = await prisma.service.findFirst({
      where: { id: serviceId, clientId: client.id },
      select: { id: true, name: true },
    });
    if (!service) {
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
          <div className="mt-3">
            <div className="text-sm font-bold uppercase text-brand">
              Naujas užimtumo įrašas · {service.name}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              Kada galite priimti užsakymus?
            </h1>
          </div>
        </header>

        {query?.error ? (
          <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text">
            {query.error}
          </div>
        ) : null}

        <AvailabilityForm
          action={createDashboardAvailabilityAction}
          hiddenField={{ name: "serviceId", value: service.id }}
          submitLabel="Sukurti įrašą"
        />
      </div>
    );
  } catch (error) {
    console.error("[dashboard-availability-new] failed to load:", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}
