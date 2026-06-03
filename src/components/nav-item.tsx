"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "lightbulb" | "plus";

interface NavItemProps {
  href: string;
  icon: IconName;
  label: string;
}

export function NavItem({ href, icon, label }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/ideas" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      }`}
    >
      <NavIcon name={icon} active={isActive} />
      {label}
    </Link>
  );
}

function NavIcon({ name, active }: { name: IconName; active: boolean }) {
  const cls = `size-4 ${active ? "text-amber-400" : "text-slate-500"}`;

  switch (name) {
    case "lightbulb":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      );
    case "plus":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
  }
}
