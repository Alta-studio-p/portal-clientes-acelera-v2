import type { ReactNode } from "react";
import { NavLinks } from "@/components/nav-links";
import { initials } from "@/lib/format";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  roleLabel,
  userName,
  userEmail,
  searchAction,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userName: string;
  userEmail: string;
  /** Form GET target for the top search box. Omit to hide search (e.g. portal, which only ever has one client). */
  searchAction?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <a href={navItems[0]?.href ?? "/"} className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-7 w-7 object-contain" />
            <span className="hidden text-sm font-semibold text-foreground sm:inline">Acelera Talent</span>
          </a>

          <NavLinks
            items={navItems}
            className="hidden flex-1 items-center gap-5 md:flex"
            linkClassName="border-b-2 py-4 text-sm font-medium transition -mb-px"
            activeClassName="border-accent text-foreground"
            inactiveClassName="border-transparent text-muted hover:text-foreground"
          />

          <div className="ml-auto flex items-center gap-2">
            {searchAction && (
              <form action={searchAction} method="get" className="hidden lg:block">
                <input
                  type="search"
                  name="q"
                  placeholder="Buscar clientes…"
                  aria-label="Buscar clientes"
                  className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </form>
            )}

            <details className="group relative">
              <summary
                aria-label="Cuenta"
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden"
              >
                {initials(userName, userEmail)}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-surface p-3 text-left shadow-lg">
                <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                <p className="truncate text-xs text-muted-2">{userEmail}</p>
                <p className="mt-1 text-xs text-muted-2">{roleLabel}</p>
                <form action="/logout" method="post" className="mt-3 border-t border-border pt-3">
                  <button
                    type="submit"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-surface-muted hover:text-foreground"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>

        <NavLinks
          items={navItems}
          className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden"
          linkClassName="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition"
          activeClassName="bg-accent-soft text-accent"
          inactiveClassName="text-muted hover:bg-surface-muted hover:text-foreground"
        />
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
