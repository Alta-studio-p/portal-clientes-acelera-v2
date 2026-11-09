import type { ReactNode } from "react";
import { NavLinks } from "@/components/nav-links";
import { initials } from "@/lib/format";
import { Search, LogOut, ChevronDown } from "lucide-react";

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
        <div className="mx-auto flex h-16 max-w-[1664px] items-center gap-5 px-4 md:px-8">
          <a href={navItems[0]?.href ?? "/"} className="flex shrink-0 items-center gap-2.5 rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-8 w-8 object-contain" />
            <span className="block"><span className="block text-sm font-semibold text-foreground">Acelera Talent</span><span className="block text-xs text-muted">{roleLabel}</span></span>
          </a>

          <NavLinks
            items={navItems}
            className="hidden min-w-0 flex-1 items-center gap-1 xl:flex"
            linkClassName="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors"
            activeClassName="bg-accent-soft text-accent"
            inactiveClassName="text-muted hover:bg-surface-muted hover:text-foreground"
          />

          <div className="ml-auto flex items-center gap-2">
            {searchAction && (
              <form action={searchAction} method="get" className="relative hidden 2xl:block">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-muted" />
                <input
                  type="search"
                  name="q"
                  placeholder="Buscar clientes…"
                  aria-label="Buscar clientes"
                  className="h-10 w-52 rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </form>
            )}

            <details className="group relative">
              <summary
                aria-label="Cuenta"
                className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md p-1 text-accent hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold">{initials(userName, userEmail)}</span><ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-surface p-4 text-left shadow-[0_8px_30px_-8px_rgba(25,40,48,0.24)] ring-1 ring-border">
                <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                <p className="truncate text-xs text-muted-2">{userEmail}</p>
                <p className="mt-1 text-xs text-muted-2">{roleLabel}</p>
                <form action="/logout" method="post" className="mt-3 border-t border-border pt-3">
                  <button
                    type="submit"
                    className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>

        <NavLinks
          items={navItems}
          className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 xl:hidden"
          linkClassName="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
          activeClassName="bg-accent-soft text-accent"
          inactiveClassName="text-muted hover:bg-surface-muted hover:text-foreground"
        />
      </header>

      <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface p-3 text-accent shadow-md focus:not-sr-only">Ir al contenido</a>
      <main id="main-content" className="app-content min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
