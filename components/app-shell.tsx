import Link from "next/link";
import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  navItems,
  roleLabel,
  userName,
  userEmail,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userName: string;
  userEmail: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
            A
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Acelera</p>
            <p className="text-[11px] text-muted-2">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <div className="mb-2 truncate px-2">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-2">{userEmail}</p>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted transition hover:bg-surface-muted hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white">
              A
            </div>
            <span className="text-sm font-semibold text-foreground">Acelera · {roleLabel}</span>
          </div>
          <form action="/logout" method="post">
            <button type="submit" className="text-xs font-medium text-muted">
              Salir
            </button>
          </form>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
