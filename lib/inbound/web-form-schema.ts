import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();

export const webFormInboundSchema = z.object({
  submittedAt: z.string().datetime({ offset: true }).optional(),
  name: optionalText(200),
  email: z.string().trim().email().optional().nullable(),
  phone: optionalText(100),
  city: optionalText(200),
  message: z.string().trim().min(1).max(20_000),
  pageUrl: z.string().url().max(2_000).optional().nullable(),
});

export type WebFormInboundPayload = z.infer<typeof webFormInboundSchema>;
