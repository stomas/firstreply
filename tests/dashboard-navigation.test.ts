import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_NAV_SECTIONS,
  getDashboardNavigationSections,
  getDashboardNavigationItems,
} from "../lib/dashboard/navigation";

describe("dashboard navigation", () => {
  it("contains the main FirstReply product areas", () => {
    const labels = getDashboardNavigationItems({
      NODE_ENV: "production",
    }).map((item) => item.label);

    assert.deepEqual(labels, [
      "Užklausos",
      "Testavimas",
      "Paslaugos",
      "Taisyklės",
      "Užimtumas",
      "Atsakymai",
      "Follow-up",
      "Ataskaitos",
      "Integracijos",
      "Nustatymai",
    ]);
  });

  it("keeps placeholder pages under the dashboard route", () => {
    const items = getDashboardNavigationItems({
      NODE_ENV: "production",
    });
    const ids = new Set(items.map((item) => item.id));

    assert.equal(ids.size, items.length);
    assert.ok(items.every((item) => item.href.startsWith("/dashboard")));
    assert.deepEqual(
      DASHBOARD_NAV_SECTIONS.map((section) => section.label),
      ["Darbas", "Konfigūracija", "Augimas"],
    );
  });

  it("shows Super Admin only when the feature is enabled", () => {
    const productionLabels = getDashboardNavigationItems({
      NODE_ENV: "production",
    }).map((item) => item.label);
    const devLabels = getDashboardNavigationItems({
      NODE_ENV: "development",
    }).map((item) => item.label);
    const flaggedProductionLabels = getDashboardNavigationItems({
      NODE_ENV: "production",
      SUPER_ADMIN_ENABLED: "true",
    }).map((item) => item.label);

    assert.equal(productionLabels.includes("Super Admin"), false);
    assert.equal(devLabels.includes("Super Admin"), true);
    assert.equal(flaggedProductionLabels.includes("Super Admin"), true);
  });

  it("places Super Admin under configuration when enabled", () => {
    const sections = getDashboardNavigationSections({
      NODE_ENV: "development",
    });
    const configuration = sections.find(
      (section) => section.label === "Konfigūracija",
    );

    assert.ok(configuration);
    assert.equal(
      configuration.items.some((item) => item.id === "super-admin"),
      true,
    );
  });
});
