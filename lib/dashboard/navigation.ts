export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  status: "live" | "placeholder";
  activePaths?: string[];
};

export type DashboardNavSection = {
  label: string;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAV_SECTIONS: DashboardNavSection[] = [
  {
    label: "Darbas",
    items: [
      {
        id: "leads",
        label: "Užklausos",
        href: "/dashboard",
        status: "live",
        activePaths: ["/dashboard", "/dashboard/leads"],
      },
      {
        id: "test",
        label: "Testavimas",
        href: "/dashboard/test",
        status: "live",
      },
    ],
  },
  {
    label: "Konfigūracija",
    items: [
      {
        id: "services",
        label: "Paslaugos",
        href: "/dashboard/services",
        status: "live",
      },
      {
        id: "rules",
        label: "Taisyklės",
        href: "/dashboard/rules",
        status: "live",
      },
      {
        id: "availability",
        label: "Užimtumas",
        href: "/dashboard/availability",
        status: "placeholder",
      },
    ],
  },
  {
    label: "Augimas",
    items: [
      {
        id: "responses",
        label: "Atsakymai",
        href: "/dashboard/responses",
        status: "placeholder",
      },
      {
        id: "follow-up",
        label: "Follow-up",
        href: "/dashboard/follow-up",
        status: "placeholder",
      },
      {
        id: "reports",
        label: "Ataskaitos",
        href: "/dashboard/reports",
        status: "placeholder",
      },
      {
        id: "integrations",
        label: "Integracijos",
        href: "/dashboard/integrations",
        status: "placeholder",
      },
      {
        id: "settings",
        label: "Nustatymai",
        href: "/dashboard/settings",
        status: "placeholder",
      },
    ],
  },
];

export function getDashboardNavigationItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_SECTIONS.flatMap((section) => section.items);
}
