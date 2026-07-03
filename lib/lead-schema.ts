import { z } from "zod";

/**
 * Allowed "current sources" for a lead. Kept as a const tuple so both the
 * form UI and the Zod schema stay in sync.
 */
export const LEAD_SOURCES = [
  { value: "web-forma", label: "Web forma" },
  { value: "paslaugos-lt", label: "Paslaugos.lt" },
  { value: "abu", label: "Abu" },
  { value: "kita", label: "Kita" },
] as const;

export const LEAD_SOURCE_VALUES = LEAD_SOURCES.map((s) => s.value) as [
  string,
  ...string[],
];

export const INQUIRY_VOLUMES = [
  { value: "iki-10", label: "Iki 10" },
  { value: "10-30", label: "10–30" },
  { value: "30-50", label: "30–50" },
  { value: "50-plus", label: "50+" },
] as const;

export const INQUIRY_VOLUME_VALUES = INQUIRY_VOLUMES.map((v) => v.value) as [
  string,
  ...string[],
];

/**
 * Shared lead schema — used on the client for inline validation and on the
 * server (API route) as the source of truth. The `website` field doubles as a
 * honeypot in the UI is handled separately; the real optional website is here.
 */
export const leadSchema = z.object({
  name: z
    .string({ required_error: "Įveskite vardą." })
    .trim()
    .min(2, "Vardas per trumpas.")
    .max(80, "Vardas per ilgas."),
  company: z
    .string({ required_error: "Įveskite įmonės pavadinimą." })
    .trim()
    .min(2, "Įmonės pavadinimas per trumpas.")
    .max(120, "Įmonės pavadinimas per ilgas."),
  email: z
    .string({ required_error: "Įveskite el. paštą." })
    .trim()
    .email("Neteisingas el. pašto adresas."),
  phone: z
    .string()
    .trim()
    .max(40, "Telefono numeris per ilgas.")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(200, "Nuoroda per ilga.")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .max(2000, "Papildoma žinutė per ilga (maks. 2000 simbolių).")
    .optional()
    .or(z.literal("")),
  source: z.enum(LEAD_SOURCE_VALUES, {
    errorMap: () => ({ message: "Pasirinkite užklausų šaltinį." }),
  }),
  monthlyInquiries: z.enum(INQUIRY_VOLUME_VALUES, {
    errorMap: () => ({ message: "Pasirinkite užklausų kiekį." }),
  }),
  services: z
    .string({ required_error: "Parašykite, kokias paslaugas norite automatizuoti." })
    .trim()
    .min(3, "Parašykite bent vieną paslaugą.")
    .max(500, "Paslaugų aprašymas per ilgas (maks. 500 simbolių)."),
  // Honeypot: real users leave this empty; bots tend to fill every field.
  // We intentionally accept any value here so the schema does NOT reject a
  // filled honeypot — the API route detects it and silently drops the lead,
  // so bots never learn they were caught.
  companyWebsite: z.string().optional().or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;

/**
 * Flatten Zod errors into a simple field -> message map for the form UI.
 */
export function fieldErrors(
  error: z.ZodError<LeadInput>,
): Partial<Record<keyof LeadInput, string>> {
  const flat = error.flatten().fieldErrors;
  const out: Partial<Record<keyof LeadInput, string>> = {};
  (Object.keys(flat) as Array<keyof LeadInput>).forEach((key) => {
    const first = flat[key]?.[0];
    if (first) out[key] = first;
  });
  return out;
}
