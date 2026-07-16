import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_NAV_SECTIONS,
  getDashboardNavigationSections,
  getDashboardNavigationItems,
} from "../lib/dashboard/navigation";

describe("dashboard navigation", () => {
  it("contains the main FirstReply product areas", () => {
    const labels = getDashboardNavigationItems().map((item) => item.label);

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
    const items = getDashboardNavigationItems();
    const ids = new Set(items.map((item) => item.id));

    assert.equal(ids.size, items.length);
    assert.ok(items.every((item) => item.href.startsWith("/dashboard")));
    assert.deepEqual(
      DASHBOARD_NAV_SECTIONS.map((section) => section.label),
      ["Darbas", "Konfigūracija", "Augimas"],
    );
  });

  it("shows Super Admin only for a Super Admin viewer", () => {
    const clientLabels = getDashboardNavigationItems().map(
      (item) => item.label,
    );
    const superAdminLabels = getDashboardNavigationItems({
      isSuperAdmin: true,
    }).map((item) => item.label);

    assert.equal(clientLabels.includes("Super Admin"), false);
    assert.equal(superAdminLabels.includes("Super Admin"), true);
    assert.equal(clientLabels.includes("El. pašto testas"), false);
    assert.equal(superAdminLabels.includes("El. pašto testas"), true);
  });

  it("exposes the real email smoke test only to Super Admin navigation", () => {
    const emailTest = getDashboardNavigationItems({ isSuperAdmin: true }).find(
      (item) => item.id === "email-test",
    );

    assert.deepEqual(emailTest, {
      id: "email-test",
      label: "El. pašto testas",
      href: "/dashboard/email-test",
      status: "live",
    });
  });

  it("places Super Admin under configuration when enabled", () => {
    const sections = getDashboardNavigationSections({
      isSuperAdmin: true,
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

  it("exposes source integrations as a live dashboard area", () => {
    const integrations = getDashboardNavigationItems().find(
      (item) => item.id === "integrations",
    );

    assert.ok(integrations);
    assert.equal(integrations.status, "live");
    assert.equal(integrations.href, "/dashboard/integrations");
  });
});
