"use client";

import { useState } from "react";

type OfferingAnswerFieldsProps = {
  serviceId: string;
  serviceLabel: string;
  defaultDescription: string;
  defaultFollowup: string;
};

type SuggestionResponse =
  | { ok: true; description: string; followup: string }
  | { ok: false; error: string };

// Redaguojami offering laukai su gyva atsakymo peržiūra ir AI pasiūlymu.
// AI kviečiamas TIK čia, konfigūravimo metu — sugeneruotas tekstas tik
// užpildo laukus; klientams jis išeina tik savininkui paspaudus „Išsaugoti".
export function OfferingAnswerFields({
  serviceId,
  serviceLabel,
  defaultDescription,
  defaultFollowup,
}: OfferingAnswerFieldsProps) {
  const [description, setDescription] = useState(defaultDescription);
  const [followup, setFollowup] = useState(defaultFollowup);
  const [tone, setTone] = useState("dalykiskas");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  async function onGenerate() {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch(
        "/api/dashboard/services/offering-suggestion",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId, tone }),
        },
      );
      const json = (await response.json()) as SuggestionResponse;

      if (!json.ok) {
        setGenerationError(json.error);
        return;
      }

      setDescription(json.description);
      setFollowup(json.followup);
    } catch {
      setGenerationError(
        "AI pasiūlymo nepavyko sugeneruoti — pabandykite dar kartą.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const exampleQuestion = `Laba diena, ar teikiate paslaugą „${serviceLabel}“?`;
  const previewAnswer = [
    "Sveiki, ačiū už užklausą.",
    description.trim(),
    followup.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-brand-tintborder bg-brand-tint p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Tonas
            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 font-normal"
            >
              <option value="dalykiskas">Dalykiškas</option>
              <option value="draugiskas">Draugiškas</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-cta hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGenerating ? "Generuojama..." : "Sugeneruoti su AI"}
          </button>
          <p className="basis-full text-xs leading-relaxed text-ink-soft">
            AI parašys tekstą iš paslaugos duomenų ir užpildys laukus žemiau.
            Klientams niekas neišsiunčiama, kol neperžiūrėsite ir nepaspausite
            „Išsaugoti“.
          </p>
        </div>
        {generationError ? (
          <p className="mt-2 text-sm font-semibold text-warn-text">
            {generationError}
          </p>
        ) : null}
      </div>

      <label className="grid gap-1 text-sm font-semibold text-ink">
        Atsakymo tekstas
        <textarea
          name="offeringDescription"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Taip, montuojame segmentines tvoras visoje Lietuvoje."
          className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
        />
        <span className="text-xs font-normal leading-relaxed text-ink-muted">
          Rašykite taip, lyg atsakytumėte klientui žinute — patvirtinkite, kad
          paslaugą teikiate, ir trumpai ją apibūdinkite.
        </span>
      </label>

      <label className="grid gap-1 text-sm font-semibold text-ink">
        Tęsinys — pakvieskite tęsti pokalbį (nebūtina)
        <textarea
          name="offeringFollowup"
          rows={2}
          value={followup}
          onChange={(event) => setFollowup(event.target.value)}
          placeholder="Jei atsiųsite tvoros ilgį ir aukštį, paskaičiuosiu orientacinę kainą."
          className="resize-y rounded-lg border border-line px-3 py-2 font-normal leading-relaxed"
        />
        <span className="text-xs font-normal leading-relaxed text-ink-muted">
          Paprastai — klausimas, kokios informacijos reikia kainai paskaičiuoti.
        </span>
      </label>

      <div className="rounded-lg border border-line bg-line-soft p-4">
        <div className="text-xs font-bold uppercase text-ink-muted">
          Kaip atrodys pokalbis
        </div>
        <div className="mt-3 grid gap-2">
          <div className="max-w-[85%] justify-self-start rounded-lg rounded-bl-sm border border-line bg-white px-3 py-2 text-sm leading-relaxed text-ink-soft">
            {exampleQuestion}
          </div>
          {description.trim() ? (
            <div className="max-w-[85%] justify-self-end rounded-lg rounded-br-sm bg-brand-tint px-3 py-2 text-sm leading-relaxed text-ink">
              {previewAnswer}
            </div>
          ) : (
            <div className="max-w-[85%] justify-self-end rounded-lg rounded-br-sm border border-warn-border bg-warn-bg px-3 py-2 text-sm leading-relaxed text-warn-text">
              Atsakymo teksto dar nėra — tokie klausimai keliaus į rankinę
              peržiūrą, kol jo neįrašysite.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
