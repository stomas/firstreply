import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOfferingSuggestionRequest,
  generateOfferingSuggestionFromContext,
  isOfferingTone,
  parseOfferingSuggestion,
  type OfferingSuggestionContext,
} from "../lib/ai/offering-suggestion";

const aiEnv = { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" };

const context: OfferingSuggestionContext = {
  serviceName: "Segmentinės tvoros montavimas",
  serviceLabel: "Segmentinė tvora",
  subjects: [{ labelLt: "Tvora", descriptionLt: "tvora, sklypo aptvėrimas" }],
  keywords: ["tvora", "segmentinė"],
  pricingUnits: ["€/m"],
  questionLabels: ["Tvoros ilgis", "Tvoros aukštis"],
};

describe("offering suggestion", () => {
  it("includes the service data and tone in the AI request", () => {
    const dalykiskas = buildOfferingSuggestionRequest(
      context,
      "dalykiskas",
      aiEnv,
    );
    const draugiskas = buildOfferingSuggestionRequest(
      context,
      "draugiskas",
      aiEnv,
    );

    assert.equal(dalykiskas.model, "test-model");
    assert.ok(dalykiskas.user.includes("Segmentinės tvoros montavimas"));
    assert.ok(dalykiskas.user.includes("Tvoros ilgis"));
    assert.ok(dalykiskas.system.includes("dalykiškas"));
    assert.ok(draugiskas.system.includes("draugiškas"));
    assert.ok(dalykiskas.system.includes("NIEKO neišgalvok"));
  });

  it("accepts a valid AI suggestion", async () => {
    const result = await generateOfferingSuggestionFromContext(
      context,
      "dalykiskas",
      {
        env: aiEnv,
        callModel: async () =>
          JSON.stringify({
            description: "Taip, montuojame segmentines tvoras.",
            followup: "Atsiųskite tvoros ilgį ir aukštį.",
          }),
      },
    );

    assert.deepEqual(result, {
      ok: true,
      description: "Taip, montuojame segmentines tvoras.",
      followup: "Atsiųskite tvoros ilgį ir aukštį.",
    });
  });

  it("retries once and fails gracefully on invalid JSON", async () => {
    let calls = 0;
    const result = await generateOfferingSuggestionFromContext(
      context,
      "dalykiskas",
      {
        env: aiEnv,
        callModel: async () => {
          calls += 1;
          return "ne json";
        },
      },
    );

    assert.equal(calls, 2);
    assert.ok(!result.ok);
    assert.match(result.error, /nepavyko/u);
  });

  it("returns a clear error without calling AI when it is not configured", async () => {
    let called = false;
    const result = await generateOfferingSuggestionFromContext(
      context,
      "dalykiskas",
      {
        env: {},
        callModel: async () => {
          called = true;
          return "{}";
        },
      },
    );

    assert.ok(!result.ok);
    assert.match(result.error, /nesukonfigūruotas/u);
    assert.equal(called, false);
  });

  it("parses fenced JSON and rejects empty descriptions", () => {
    assert.deepEqual(
      parseOfferingSuggestion(
        '```json\n{"description":"Taip, darome.","followup":""}\n```',
      ),
      { description: "Taip, darome.", followup: "" },
    );
    assert.equal(
      parseOfferingSuggestion('{"description":"","followup":"x"}'),
      null,
    );
  });

  it("validates tones", () => {
    assert.equal(isOfferingTone("dalykiskas"), true);
    assert.equal(isOfferingTone("draugiskas"), true);
    assert.equal(isOfferingTone("piktas"), false);
  });
});
