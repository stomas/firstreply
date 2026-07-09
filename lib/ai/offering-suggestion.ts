import { z } from "zod";
import {
  callOpenAiResponsesApi,
  isAiConfigured,
  stripJsonFence,
  type AiEnvironment,
  type AiModelCaller,
  type AiModelRequest,
} from "@/lib/ai/openai-client";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

// AI pasiūlymas offering atsakymui — kviečiamas TIK konfigūravimo metu
// (dashboard formoje), rezultatas įpilamas į laukus ir išsiunčiamas klientams
// tik savininkui peržiūrėjus ir išsaugojus. Runtime atsakymai lieka
// deterministiniai iš DB.

export const OFFERING_TONES = [
  { value: "dalykiskas", label: "Dalykiškas" },
  { value: "draugiskas", label: "Draugiškas" },
] as const;

export type OfferingTone = (typeof OFFERING_TONES)[number]["value"];

export type OfferingSuggestionContext = {
  serviceName: string;
  serviceLabel: string | null;
  subjects: Array<{ labelLt: string; descriptionLt: string }>;
  keywords: string[];
  pricingUnits: string[];
  questionLabels: string[];
};

export type OfferingSuggestionResult =
  | { ok: true; description: string; followup: string }
  | { ok: false; error: string };

const suggestionSchema = z.object({
  description: z.string().trim().min(1).max(600),
  followup: z.string().trim().max(600).default(""),
});

export async function generateOfferingSuggestion(
  clientId: string,
  serviceId: string,
  tone: OfferingTone,
  options: { env?: AiEnvironment; callModel?: AiModelCaller } = {},
): Promise<OfferingSuggestionResult> {
  assertDatabaseConfigured();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, clientId },
    include: {
      subjects: {
        orderBy: { labelLt: "asc" },
        select: { labelLt: true, descriptionLt: true },
      },
      pricingRules: {
        where: { active: true },
        select: { unit: true },
      },
      decisionRequirements: {
        where: { active: true },
        orderBy: [{ priority: "asc" }],
        select: { label: true },
      },
    },
  });
  if (!service) {
    return { ok: false, error: "Paslauga nerasta." };
  }

  return generateOfferingSuggestionFromContext(
    {
      serviceName: service.name,
      serviceLabel: service.label,
      subjects: service.subjects,
      keywords: Array.isArray(service.keywords)
        ? service.keywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : [],
      pricingUnits: service.pricingRules
        .map((rule) => rule.unit)
        .filter((unit): unit is string => Boolean(unit)),
      questionLabels: service.decisionRequirements.map(
        (requirement) => requirement.label,
      ),
    },
    tone,
    options,
  );
}

export async function generateOfferingSuggestionFromContext(
  context: OfferingSuggestionContext,
  tone: OfferingTone,
  options: { env?: AiEnvironment; callModel?: AiModelCaller } = {},
): Promise<OfferingSuggestionResult> {
  const env = options.env ?? process.env;
  if (!isAiConfigured(env)) {
    return {
      ok: false,
      error:
        "AI generavimas nesukonfigūruotas — įrašykite tekstą ranka arba susisiekite su FirstReply.",
    };
  }

  const request = buildOfferingSuggestionRequest(context, tone, env);
  const callModel = options.callModel ?? callOpenAiResponsesApi;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rawResponse = await callModel(request);
    const parsed = parseOfferingSuggestion(rawResponse);
    if (parsed) {
      return {
        ok: true,
        description: parsed.description,
        followup: parsed.followup,
      };
    }
  }

  return {
    ok: false,
    error: "AI pasiūlymo nepavyko sugeneruoti — pabandykite dar kartą.",
  };
}

export function buildOfferingSuggestionRequest(
  context: OfferingSuggestionContext,
  tone: OfferingTone,
  env: AiEnvironment,
): AiModelRequest {
  const toneInstruction =
    tone === "draugiskas"
      ? "Tonas: draugiškas, šiltas, bet profesionalus."
      : "Tonas: dalykiškas, mandagus, be familiarumo.";

  return {
    model: env.OPENAI_MODEL?.trim() ?? "",
    system:
      'Tu padedi lietuviškam paslaugų verslui parašyti atsakymą klientui, kuris klausia, ar tokia paslauga teikiama. Grąžink TIK validų JSON {"description", "followup"}. Taisyklės: ' +
      "1. Naudok TIK pateiktus duomenis — NIEKO neišgalvok: jokių kainų, terminų, garantijų, medžiagų ar savybių, kurių nėra duomenyse. " +
      "2. description: 1-2 sakiniai — patvirtink, kad paslauga teikiama, ir trumpai ją apibūdink. " +
      "3. followup: 1 sakinys — pakviesk atsiųsti informaciją orientacinei kainai (remkis pateiktais klausimais, jei jų nėra — bendras kvietimas). " +
      "4. BE pasisveikinimo ir BE atsisveikinimo — jie pridedami automatiškai. " +
      "5. Rašyk lietuviškai, natūralia kalba. " +
      toneInstruction,
    user: JSON.stringify({
      serviceName: context.serviceName,
      serviceLabel: context.serviceLabel,
      subjects: context.subjects,
      keywords: context.keywords,
      pricingUnits: context.pricingUnits,
      questionLabels: context.questionLabels,
      responseSchema: {
        description: "atsakymo tekstas",
        followup: "kvietimas tęsti pokalbį",
      },
    }),
  };
}

export function parseOfferingSuggestion(
  rawResponse: string,
): { description: string; followup: string } | null {
  try {
    return suggestionSchema.parse(JSON.parse(stripJsonFence(rawResponse)));
  } catch {
    return null;
  }
}

export function isOfferingTone(value: string): value is OfferingTone {
  return OFFERING_TONES.some((tone) => tone.value === value);
}
