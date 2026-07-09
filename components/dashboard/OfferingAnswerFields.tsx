"use client";

import { useState } from "react";

type OfferingAnswerFieldsProps = {
  serviceLabel: string;
  defaultDescription: string;
  defaultFollowup: string;
};

// Redaguojami offering laukai su gyva atsakymo peržiūra: naudotojas iškart
// mato, kokią žinutę gaus klientas, paklausęs „ar darote X?".
export function OfferingAnswerFields({
  serviceLabel,
  defaultDescription,
  defaultFollowup,
}: OfferingAnswerFieldsProps) {
  const [description, setDescription] = useState(defaultDescription);
  const [followup, setFollowup] = useState(defaultFollowup);

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
