import type { LeadSummary } from "@/lib/leads/get-leads";

const labels: Array<{ key: keyof LeadSummary; label: string }> = [
  { key: "totalThisMonth", label: "Total šį mėnesį" },
  { key: "realThisMonth", label: "Real leads" },
  { key: "testThisMonth", label: "Test leads" },
  { key: "waitingManualReview", label: "Manual review" },
  { key: "responseReady", label: "Response ready" },
  { key: "autoSendAllowed", label: "Auto-send allowed" },
  { key: "noResponseWaiting", label: "No response / waiting" },
];

export function LeadSummaryCards({ summary }: { summary: LeadSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {labels.map((item) => (
        <div
          key={item.key}
          className="rounded-lg border border-line bg-white p-4 shadow-cardsoft"
        >
          <div className="text-sm font-medium text-ink-soft">{item.label}</div>
          <div className="mt-2 text-3xl font-extrabold text-ink">
            {summary[item.key]}
          </div>
        </div>
      ))}
    </div>
  );
}
