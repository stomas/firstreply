import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(200, "Reikšmė per ilga.")
  .optional()
  .or(z.literal(""));

export const testInquirySchema = z.object({
  serviceId: z.string().trim().min(1, "Pasirinkite paslaugą."),
  customerName: optionalText,
  customerEmail: z
    .string()
    .trim()
    .email("Neteisingas el. pašto adresas.")
    .optional()
    .or(z.literal("")),
  customerPhone: optionalText,
  city: optionalText,
  inquiryMessage: z
    .string()
    .trim()
    .min(3, "Įveskite testinę užklausą.")
    .max(4000, "Užklausa per ilga."),
  asksPrice: z.boolean().default(false),
  asksAvailability: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
});

export type TestInquiryInput = z.infer<typeof testInquirySchema>;

export function fieldErrors(
  error: z.ZodError<TestInquiryInput>,
): Record<string, string> {
  const flat = error.flatten().fieldErrors;
  const out: Record<string, string> = {};

  for (const [key, messages] of Object.entries(flat)) {
    const first = messages?.[0];
    if (first) {
      out[key] = first;
    }
  }

  return out;
}
