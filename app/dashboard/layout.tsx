import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { getDashboardNavigationSections } from "@/lib/dashboard/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const sections = getDashboardNavigationSections();

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <DashboardSidebar sections={sections} />
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
