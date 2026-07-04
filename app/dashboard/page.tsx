import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { LeadSummaryCards } from "@/components/dashboard/LeadSummaryCards";
import { LeadTable } from "@/components/dashboard/LeadTable";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentClient } from "@/lib/client-context";
import { getDashboardData } from "@/lib/leads/get-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const client = await getCurrentClient();
    const data = await getDashboardData(client.id);

    return (
      <main className="min-h-screen bg-page px-6 py-8">
        <div className="mx-auto max-w-content">
          <Header companyName={client.companyName} />
          <LeadSummaryCards summary={data.summary} />
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-ink">Užklausos</h2>
              <Link
                href="/dashboard/test"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover"
              >
                Testuoti atsakymą
              </Link>
            </div>
            <LeadTable leads={data.leads} />
          </section>
        </div>
      </main>
    );
  } catch (error) {
    console.error("[dashboard] failed to load:", error);
    return (
      <main className="min-h-screen bg-page px-6 py-8">
        <div className="mx-auto max-w-content">
          <DashboardError message={getAppErrorMessage(error)} />
        </div>
      </main>
    );
  }
}

function Header({ companyName }: { companyName: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-sm font-bold uppercase text-brand">FirstReply</div>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">
          {companyName} dashboard
        </h1>
      </div>
    </header>
  );
}
