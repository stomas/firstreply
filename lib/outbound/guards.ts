import { OutboundDispatchStatus, type Prisma } from "@prisma/client";
import { AppValidationError } from "@/lib/app-errors";

export async function assertNoUnfinishedOutboundDispatch(
  tx: Prisma.TransactionClient,
  conversationId: string,
): Promise<void> {
  const unfinished = await tx.outboundDispatch.findFirst({
    where: {
      conversationId,
      OR: [
        {
          status: {
            in: [
              OutboundDispatchStatus.SENDING,
              OutboundDispatchStatus.UNKNOWN,
            ],
          },
        },
        {
          status: OutboundDispatchStatus.FAILED,
          errorCode: "TRANSPORT_UNCERTAIN",
        },
      ],
    },
    select: { id: true },
  });
  if (unfinished) {
    throw new AppValidationError(
      "Pokalbis turi nebaigtą arba neaiškų siuntimą. Pirmiausia patikrinkite Resend rezultatą; būsena negali būti perrašyta rankiniu veiksmu.",
    );
  }
}
