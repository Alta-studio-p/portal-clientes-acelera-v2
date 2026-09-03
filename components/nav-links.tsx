"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/app-shell";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/coach" || href === "/portal") {
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
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${linkClassName} ${active ? activeClassName : inactiveClassName}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
