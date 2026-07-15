import { assertDatabaseConfigured, prisma } from "@/lib/db";

export type LeadSummary = {
  totalThisMonth: number;
  realThisMonth: number;
  testThisMonth: number;
  waitingManualReview: number;
  responseReady: number;
  autoSendAllowed: number;
  noResponseWaiting: number;
};

export type DashboardLead = {
  id: string;
  createdAt: string;
  sourceType: string;
  isTest: boolean;
  customerName: string | null;
  serviceName: string | null;
  city: string | null;
  status: string;
  conversationStatus: string | null;
  latestResponseStatus: string | null;
  manualReviewReason: string | null;
};

export type DashboardData = {
  summary: LeadSummary;
  leads: DashboardLead[];
};

export async function getDashboardData(
  clientId: string,
): Promise<DashboardData> {
  assertDatabaseConfigured();

  const monthStart = getMonthStart(new Date());
  const [monthLeads, leads] = await Promise.all([
    prisma.lead.findMany({
      where: {
        clientId,
        createdAt: { gte: monthStart },
      },
      include: {
        responses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.lead.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        service: true,
        conversation: { select: { status: true } },
        responses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const summary = monthLeads.reduce<LeadSummary>(
    (acc, lead) => {
      const latestResponse = lead.responses[0] ?? null;

      acc.totalThisMonth += 1;
      if (lead.isTest) {
        acc.testThisMonth += 1;
      } else {
        acc.realThisMonth += 1;
      }

      if (
        lead.status === "manual_review" ||
        latestResponse?.status === "manual_review"
      ) {
        acc.waitingManualReview += 1;
      }

      if (latestResponse?.status === "ready") {
        acc.responseReady += 1;
      }

      if (latestResponse?.autoSendAllowed) {
        acc.autoSendAllowed += 1;
      }

      if (!latestResponse) {
        acc.noResponseWaiting += 1;
      }

      return acc;
    },
    {
      totalThisMonth: 0,
      realThisMonth: 0,
      testThisMonth: 0,
      waitingManualReview: 0,
      responseReady: 0,
      autoSendAllowed: 0,
      noResponseWaiting: 0,
    },
  );

  return {
    summary,
    leads: leads.map((lead) => {
      const latestResponse = lead.responses[0] ?? null;

      return {
        id: lead.id,
        createdAt: lead.createdAt.toISOString(),
        sourceType: lead.sourceType,
        isTest: lead.isTest,
        customerName: lead.customerName,
        serviceName: lead.service?.name ?? null,
        city: lead.city,
        status: lead.status,
        conversationStatus: lead.conversation?.status ?? null,
        latestResponseStatus: latestResponse?.status ?? null,
        manualReviewReason:
          latestResponse?.manualReviewReason ?? lead.manualReviewReason,
      };
    }),
  };
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
