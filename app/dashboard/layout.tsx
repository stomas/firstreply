import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { getAuthSession } from "@/lib/auth/session";
import { resolveCurrentClientId } from "@/lib/client-context";
import { getDashboardNavigationSections } from "@/lib/dashboard/navigation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const clientOptions = isSuperAdmin
    ? await prisma.client.findMany({
        where: { status: "active" },
        orderBy: [{ companyName: "asc" }, { createdAt: "asc" }],
        select: { id: true, companyName: true },
      })
    : [];
  const selectedClientId = isSuperAdmin
    ? resolveCurrentClientId({
        role: session.user.role,
        ownedClientId: session.user.clientId,
        selectedClientId: session.selectedClientId,
        activeClientIds: clientOptions.map((client) => client.id),
      })
    : null;
  const sections = getDashboardNavigationSections({ isSuperAdmin });

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <DashboardSidebar
        sections={sections}
        email={session.user.email}
        isSuperAdmin={isSuperAdmin}
        clientOptions={clientOptions}
        selectedClientId={selectedClientId}
      />
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
