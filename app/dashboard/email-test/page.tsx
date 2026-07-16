import { randomUUID } from "node:crypto";
import Link from "next/link";
import { DashboardError } from "@/components/dashboard/DashboardError";
import { TestEmailForm } from "@/components/dashboard/TestEmailForm";
import { getAppErrorMessage } from "@/lib/app-errors";
import { getCurrentSuperAdminClient } from "@/lib/client-context";
import { getTestEmailSender } from "@/lib/outbound/test-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardEmailTestPage() {
  try {
    const client = await getCurrentSuperAdminClient();
    const sender = await getTestEmailSender(client.id);
    const sendingEnabled = process.env.EMAIL_SENDING_ENABLED === "true";

    return (
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard/integrations"
          className="text-sm font-bold text-brand hover:text-brand-hover"
        >
          Atgal į integracijas
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase text-brand">
              Super Admin
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-ink">
              El. laiško siuntimo testas
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Pasirinktas klientas: <strong>{client.companyName}</strong>. Šis
              puslapis patikrina Railway siuntimo konfigūraciją ir patvirtintą
              numatytąjį siuntėją.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              sendingEnabled
                ? "bg-brand-tint text-brand"
                : "bg-warn-bg text-warn-text"
            }`}
          >
            {sendingEnabled ? "Siuntimas įjungtas" : "Siuntimas išjungtas"}
          </span>
        </div>

        {!sendingEnabled ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-warn-border bg-warn-bg p-4 text-sm font-semibold text-warn-text"
          >
            Railway nustatykite EMAIL_SENDING_ENABLED=true ir redeployinkite.
          </div>
        ) : !sender ? (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-warn-border bg-warn-bg p-4 text-sm font-semibold text-warn-text"
          >
            Pasirinktas klientas neturi aktyvaus, patvirtinto numatytojo
            siuntėjo. Pirmiausia jį paruoškite Integracijų puslapyje.
          </div>
        ) : (
          <TestEmailForm sender={sender} initialRequestId={randomUUID()} />
        )}

        <p className="mt-5 text-xs leading-relaxed text-ink-muted">
          Šis greitas testas nesukuria užklausos ar timeline įrašo. Pilnam
          webhook ir pristatymo būsenų E2E testui naudokite Web formos leadą.
        </p>
      </div>
    );
  } catch (error) {
    console.error("[dashboard-test-email] failed to load", error);
    return (
      <div className="mx-auto max-w-content">
        <DashboardError message={getAppErrorMessage(error)} />
      </div>
    );
  }
}
