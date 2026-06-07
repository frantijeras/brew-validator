"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NavItem } from "@/components/nav-item";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

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

  const userInitials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen overflow-x-hidden">
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
          className="flex items-center gap-3 border-b border-slate-800 px-6 py-5"
          onClick={closeSidebar}
        >
          <CauldronStarsIcon />
          <span className="text-xl font-bold tracking-tight text-white">BrewIdea</span>
        </Link>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Navegación */}
          <div>
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Navegación
            </p>
            <div className="space-y-1">
              <Link
                href="/ideas"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
              >
                <PlusIcon />
                Nueva idea
              </Link>
              <NavItem href="/ideas" icon="lightbulb" label="Ideas" />
              <NavItem href="/proyectos" icon="folder" label="Proyectos" />
            </div>
          </div>

          {/* Proyectos recientes */}
          <RecentProjects onClick={closeSidebar} />

          {/* Configuración */}
          <div>
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Configuración
            </p>
            <div className="space-y-1">
              <NavItem href="/settings" icon="settings" label="Ajustes" />
            </div>
          </div>
        </div>

        {/* User + version */}
        <div className="border-t border-slate-800 px-4 py-3 space-y-2">
          {session?.user && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                  {userInitials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  {session.user.name ?? "Usuario"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogoutIcon />
              </button>
            </div>
          )}

          <p className="px-3 text-xs text-slate-600">v0.1.0</p>
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
          <CauldronStarsSmallIcon />
          <span className="text-lg font-bold tracking-tight text-white">BrewIdea</span>
        </Link>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 pt-14 md:pt-0 md:pl-64 overflow-x-hidden">
        <div className="mx-auto max-w-5xl p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ── Recent projects ── */

function RecentProjects({ onClick }: { onClick: () => void }) {
  const [projects, setProjects] = useState<Array<{
    id: string;
    name: string;
    completedPhases: number;
    total: number;
    currentPhaseType: string | null;
    status: string;
  }> | null>(null);

  useEffect(() => {
    fetch("/api/projects/recent")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));
  }, []);

  if (!projects || projects.length === 0) return null;

  return (
    <div>
      <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        Recientes
      </p>
      <div className="space-y-1">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/proyectos/${p.id}`}
            onClick={onClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-slate-800"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                p.status === "completed"
                  ? "bg-green-500/20 text-green-400"
                  : p.status === "processing"
                    ? "bg-amber-500/20 text-amber-400"
                    : p.status === "questioning"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">
                {p.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {statusText(p.status)} · {p.completedPhases}/{p.total} fases
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function statusText(status: string): string {
  switch (status) {
    case "completed": return "Completado";
    case "processing": return "Procesando";
    case "questioning": return "Esperando respuestas";
    default: return "En progreso";
  }
}

/* ── Version ── */


/* ── Icons ── */

function CauldronStarsIcon() {
  return (
    <svg
      className="size-7 text-amber-400"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 7 L17 12 L21 13 L17 14 L16 18 L15 14 L11 13 L15 12 Z" />
      <path
        d="M6 21 L7 24 L10 25 L7 26 L6 29 L5 26 L2 25 L5 24 Z"
        transform="translate(2,0)"
      />
      <path
        d="M26 21 L27 24 L30 25 L27 26 L26 29 L25 26 L22 25 L25 24 Z"
        transform="translate(-2,0)"
      />
    </svg>
  );
}

function CauldronStarsSmallIcon() {
  return (
    <svg
      className="size-5 text-amber-400"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 7 L17 12 L21 13 L17 14 L16 18 L15 14 L11 13 L15 12 Z" />
      <path
        d="M6 21 L7 24 L10 25 L7 26 L6 29 L5 26 L2 25 L5 24 Z"
        transform="translate(2,0)"
      />
      <path
        d="M26 21 L27 24 L30 25 L27 26 L26 29 L25 26 L22 25 L25 24 Z"
        transform="translate(-2,0)"
      />
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

function LogoutIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-4 text-amber-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
