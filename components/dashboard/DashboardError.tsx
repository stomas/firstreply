export function DashboardError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn-border bg-warn-bg p-5 text-sm text-warn-text">
      <div className="font-bold">Nepavyko atidaryti dashboard’o.</div>
      <p className="mt-2">{message}</p>
    </div>
  );
}
