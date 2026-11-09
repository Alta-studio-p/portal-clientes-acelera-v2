"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/app-shell";
import { LayoutDashboard, TrendingUp, CalendarDays, Users, Phone, Video, UserRound, CircleHelp } from "lucide-react";

function navIcon(href: string) {
  if (href.endsWith('/progress')) return TrendingUp;
  if (href.endsWith('/calendar')) return CalendarDays;
  if (href.endsWith('/masterclasses')) return Video;
  if (href.endsWith('/fees')) return Phone;
  if (href.endsWith('/unassigned')) return CircleHelp;
  if (href.endsWith('/coaches')) return Users;
  if (href.startsWith('/portal')) return UserRound;
  return LayoutDashboard;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/coach" || href === "/portal" || /^\/preview\/coaches\/[^/]+$/.test(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  items,
  className = "",
  linkClassName = "",
  activeClassName = "",
  inactiveClassName = "",
}: {
  items: NavItem[];
  className?: string;
  linkClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = navIcon(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${linkClassName} ${active ? activeClassName : inactiveClassName}`}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
