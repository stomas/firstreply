import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDashboardServiceForm,
  summarizeDashboardServices,
  toDashboardServiceCards,
  type DashboardServiceRecord,
} from "../lib/dashboard/services";
import { getDashboardNavigationItems } from "../lib/dashboard/navigation";

const completeService: DashboardServiceRecord = {
  id: "service_complete",
  name: "Segmentinės tvoros montavimas",
  label: "Segmentinė tvora",
  active: true,
  keywords: ["segmentinė", "tvora", "tvoros"],
  offeringDescription: "Montuojame segmentines tvoras.",
  subjects: [
    { subjectKey: "fence", labelLt: "Tvora" },
    { subjectKey: "gate", labelLt: "Vartai" },
  ],
  pricingRules: [{ active: true }],
  decisionRequirements: [
    { active: true, required: true },
    { active: true, required: false },
  ],
  availabilityRules: [{ autoSendAllowed: true }],
};

describe("dashboard services", () => {
  it("marks services as ready only when the essential setup exists", () => {
    const cards = toDashboardServiceCards([
      completeService,
      {
        ...completeService,
        id: "service_missing",
        name: "Vartai",
        keywords: [],
        offeringDescription: null,
        subjects: [],
        pricingRules: [],
        decisionRequirements: [],
        availabilityRules: [],
      },
      {
        ...completeService,
        id: "service_inactive",
        active: false,
      },
    ]);

    assert.equal(cards[0].status, "ready");
    assert.equal(cards[1].status, "needs_setup");
    assert.deepEqual(cards[1].missingSetup, [
      "atpažinimo temos",
      "raktažodžiai",
      "kainodaros taisyklė",
      "sprendimo klausimai",
      "atsakymas į „ar darote?“",
    ]);
    assert.equal(cards[2].status, "inactive");
  });

  it("summarizes active, ready, and setup-needed services", () => {
    const summary = summarizeDashboardServices([
      { ...completeService, id: "ready" },
      { ...completeService, id: "needs_setup", pricingRules: [] },
      { ...completeService, id: "inactive", active: false },
    ]);

    assert.deepEqual(summary, {
      total: 3,
      active: 2,
      ready: 1,
      needsSetup: 1,
    });
  });

  it("marks the services navigation item as live", () => {
    const item = getDashboardNavigationItems().find(
      (candidate) => candidate.id === "services",
    );

    assert.equal(item?.href, "/dashboard/services");
    assert.equal(item?.status, "live");
  });

  it("parses the compact service edit form without exposing technical fields to users", () => {
    const formData = new FormData();
    formData.set("serviceId", "service_1");
    formData.set("name", " Segmentinės tvoros montavimas ");
    formData.set("label", " Segmentinė tvora ");
    formData.set("active", "on");
    formData.set("keywords", " tvora, tvoros\nsegmentinė, tvora ");
    formData.set("offeringDescription", " Montuojame segmentines tvoras. ");
    formData.set("offeringFollowup", " Kiek metrų reikėtų? ");
    formData.append("subjectKey", "fence");
    formData.append("subjectLabel", " Tvora ");
    formData.append("subjectSynonyms", " tvora, tvoros, aptvėrimas ");
    formData.append("subjectKey", "");
    formData.append("subjectLabel", " Vartai ");
    formData.append("subjectSynonyms", " vartai, vartų ");

    assert.deepEqual(parseDashboardServiceForm(formData), {
      ok: true,
      value: {
        serviceId: "service_1",
        name: "Segmentinės tvoros montavimas",
        label: "Segmentinė tvora",
        active: true,
        keywords: ["tvora", "tvoros", "segmentinė"],
        offeringDescription: "Montuojame segmentines tvoras.",
        offeringFollowup: "Kiek metrų reikėtų?",
        subjects: [
          {
            subjectKey: "fence",
            labelLt: "Tvora",
            descriptionLt: "Tvora",
            synonyms: ["tvora", "tvoros", "aptvėrimas"],
          },
          {
            subjectKey: "vartai",
            labelLt: "Vartai",
            descriptionLt: "Vartai",
            synonyms: ["vartai", "vartų"],
          },
        ],
      },
    });
  });

  it("rejects a service edit form without a service name", () => {
    const formData = new FormData();
    formData.set("serviceId", "service_1");
    formData.set("name", " ");

    assert.deepEqual(parseDashboardServiceForm(formData), {
      ok: false,
      serviceId: "service_1",
      error: "Įveskite paslaugos pavadinimą.",
    });
  });
});
