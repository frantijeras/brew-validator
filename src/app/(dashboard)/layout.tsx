"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem } from "@/components/nav-item";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeSidebar = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex min-h-screen">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 transition-transform duration-300 ease-in-out md:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        {/* Logo */}
        <Link
          href="/ideas"
          className="flex items-center gap-3 px-6 py-5 border-b border-slate-800"
          onClick={closeSidebar}
        >
          <BeerIcon />
          <span className="text-xl font-bold tracking-tight text-white">Brew</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-4 py-6">
          <NavItem href="/ideas" icon="lightbulb" label="Ideas" />
          <NavItem href="/ideas/new" icon="plus" label="Nueva idea" />
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4">
          <p className="text-xs text-slate-500">Brew Validator v0.1</p>
        </div>
      </aside>

      {/* ── Top bar (mobile only) ── */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Abrir menú"
        >
          <MenuIcon />
        </button>
        <Link href="/ideas" className="flex items-center gap-2">
          <BeerSmallIcon />
          <span className="text-lg font-bold tracking-tight text-white">Brew</span>
        </Link>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 pt-14 md:pt-0 md:pl-64">
        <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

/* ── Icons ── */

function BeerIcon() {
  return (
    <svg
      className="size-7 text-amber-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M9 12v6" />
      <path d="M13 12v6" />
      <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
      <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    </svg>
  );
}

function BeerSmallIcon() {
  return (
    <svg
      className="size-5 text-amber-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M9 12v6" />
      <path d="M13 12v6" />
      <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z" />
      <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
