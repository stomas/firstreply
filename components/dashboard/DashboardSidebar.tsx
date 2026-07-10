"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction, selectSuperAdminClientAction } from "@/app/auth/actions";
import type {
  DashboardNavItem,
  DashboardNavSection,
} from "@/lib/dashboard/navigation";
import { cn } from "@/lib/utils";

export function DashboardSidebar({
  sections,
  email,
  isSuperAdmin,
  clientOptions,
  selectedClientId,
}: {
  sections: DashboardNavSection[];
  email: string;
  isSuperAdmin: boolean;
  clientOptions: Array<{ id: string; companyName: string }>;
  selectedClientId: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="border-b border-line bg-white/95 px-4 py-4 shadow-cardsoft lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-5 lg:py-6 lg:shadow-none">
      <div className="flex items-center justify-between gap-3 lg:block">
        <Link
          href="/dashboard"
          className="block"
          aria-label="FirstReply dashboard"
        >
          <div className="text-sm font-bold uppercase tracking-[0.08em] text-brand">
            FirstReply
          </div>
          <div className="mt-0.5 font-display text-xl font-extrabold text-ink">
            Valdymas
          </div>
        </Link>
        <div className="rounded-full border border-line bg-line-soft px-3 py-1 text-xs font-bold text-ink-soft lg:mt-4 lg:inline-flex">
          Starter
        </div>
      </div>

      <nav
        aria-label="Dashboard navigacija"
        className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:flex-1 lg:overflow-visible lg:pb-0"
      >
        {sections.map((section) => (
          <div
            key={section.label}
            className="flex shrink-0 gap-2 lg:mb-7 lg:block lg:shrink"
          >
            <div className="sr-only lg:not-sr-only lg:mb-2 lg:px-3 lg:text-xs lg:font-extrabold lg:uppercase lg:tracking-[0.08em] lg:text-ink-muted">
              {section.label}
            </div>
            <div className="flex gap-2 lg:grid lg:gap-1">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  active={isActive(item, pathname)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-5 border-t border-line pt-4 lg:mt-auto">
        {isSuperAdmin ? (
          <form
            action={selectSuperAdminClientAction}
            className="mb-4 grid gap-2"
          >
            <input type="hidden" name="returnTo" value={pathname} />
            <label
              htmlFor="dashboard-client"
              className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-muted"
            >
              Aktyvus klientas
            </label>
            {clientOptions.length ? (
              <>
                <select
                  key={selectedClientId ?? "no-client"}
                  id="dashboard-client"
                  name="clientId"
                  defaultValue={selectedClientId ?? undefined}
                  onChange={(event) =>
                    event.currentTarget.form?.requestSubmit()
                  }
                  className="min-h-10 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand"
                >
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName} ({client.id})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-brand-tintborder bg-brand-tint px-3 py-2 text-sm font-bold text-brand hover:bg-brand-reply"
                >
                  Pritaikyti pasirinkimą
                </button>
                <span className="text-xs leading-relaxed text-ink-muted">
                  Pasirinkus kitą klientą dashboardas persijungia automatiškai.
                </span>
              </>
            ) : (
              <span className="text-sm text-ink-muted">
                Aktyvių klientų nėra.
              </span>
            )}
          </form>
        ) : null}

        <div
          className="truncate text-xs font-semibold text-ink-soft"
          title={email}
        >
          {email}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          {isSuperAdmin ? "Super Admin" : "Kliento paskyra"}
        </div>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm font-bold text-ink-soft hover:bg-line-soft hover:text-ink"
          >
            Atsijungti
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
}: {
  item: DashboardNavItem;
  active: boolean;
}) {
  if (item.status === "placeholder") {
    return (
      <span className="flex min-h-10 cursor-default items-center justify-between gap-3 whitespace-nowrap rounded-lg border border-transparent px-3 py-2 text-sm font-bold text-ink-muted">
        <span>{item.label}</span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-extrabold uppercase text-ink-muted">
          Greit
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center justify-between gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
        active
          ? "border-brand-tintborder bg-brand-tint text-brand"
          : "border-transparent text-ink-soft hover:border-line hover:bg-line-soft hover:text-ink",
      )}
    >
      <span>{item.label}</span>
    </Link>
  );
}

function isActive(item: DashboardNavItem, pathname: string): boolean {
  const activePaths = item.activePaths ?? [item.href];
  return activePaths.some((path) =>
    path === "/dashboard" ? pathname === path : pathname.startsWith(path),
  );
}
