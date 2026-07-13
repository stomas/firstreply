import Link from "next/link";
import type { DashboardLead } from "@/lib/leads/get-leads";

export function LeadTable({ leads }: { leads: DashboardLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-sm text-ink-soft">
        Kol kas užklausų nėra.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-cardsoft">
      <table className="min-w-full divide-y divide-line text-left text-sm">
        <thead className="bg-line-soft text-xs uppercase text-ink-soft">
          <tr>
            <th className="px-4 py-3 font-bold">Data</th>
            <th className="px-4 py-3 font-bold">Šaltinis</th>
            <th className="px-4 py-3 font-bold">Test</th>
            <th className="px-4 py-3 font-bold">Klientas</th>
            <th className="px-4 py-3 font-bold">Paslauga</th>
            <th className="px-4 py-3 font-bold">Miestas</th>
            <th className="px-4 py-3 font-bold">Lead status</th>
            <th className="px-4 py-3 font-bold">Pokalbis</th>
            <th className="px-4 py-3 font-bold">Response</th>
            <th className="px-4 py-3 font-bold">Manual reason</th>
            <th className="px-4 py-3 font-bold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {leads.map((lead) => (
            <tr key={lead.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                {formatDate(lead.createdAt)}
              </td>
              <td className="px-4 py-3">{lead.sourceType}</td>
              <td className="px-4 py-3">{lead.isTest ? "Taip" : "Ne"}</td>
              <td className="px-4 py-3 font-medium">
                {lead.customerName || "Nežinomas klientas"}
              </td>
              <td className="px-4 py-3">{lead.serviceName || "—"}</td>
              <td className="px-4 py-3">{lead.city || "—"}</td>
              <td className="px-4 py-3">{lead.status}</td>
              <td className="px-4 py-3">
                {lead.conversationStatus
                  ? conversationStatusLabel(lead.conversationStatus)
                  : "—"}
              </td>
              <td className="px-4 py-3">{lead.latestResponseStatus || "—"}</td>
              <td className="max-w-[280px] px-4 py-3 text-ink-soft">
                {lead.manualReviewReason || "—"}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="font-bold text-brand hover:text-brand-hover"
                >
                  Atidaryti
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Vilnius",
  }).format(new Date(value));
}

function conversationStatusLabel(status: string): string {
  if (status === "NEEDS_REPLY") return "Reikia atsakyti";
  if (status === "WAITING_CUSTOMER") return "Laukiama kliento";
  if (status === "MANUAL_REVIEW") return "Reikia peržiūros";
  if (status === "CLOSED") return "Uždarytas";
  return status;
}
