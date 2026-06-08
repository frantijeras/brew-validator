"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  HelpCircle,
  Play,
  Eye,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";

interface ProjectRowProps {
  project: {
    id: string;
    name: string;
    updatedAt: Date;
    idea: { title: string | null; description: string | null };
    phases: { status: string; label: string; sortOrder: number }[];
  };
  avatarStyle: { bg: string; text: string };
  statusText: string;
  statusBadgeClass: string;
  CTALabel: string;
  allDone: boolean;
  completed: number;
  total: number;
  currentPhaseLabel: string | null;
}

const CTA_ICONS: Record<string, React.ElementType> = {
  completed: Eye,
  processing: Clock,
  questioning: HelpCircle,
  default: Play,
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return `hace ${Math.floor(days / 7)}sem`;
}

export function ProjectRow({
  project,
  avatarStyle,
  statusText,
  statusBadgeClass,
  CTALabel,
  allDone,
  completed,
  total,
  currentPhaseLabel,
}: ProjectRowProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusKey = allDone
    ? "completed"
    : statusText === "Procesando…"
      ? "processing"
      : statusText === "Esperando respuestas"
        ? "questioning"
        : "default";
  const CTAIcon = CTA_ICONS[statusKey] || Play;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function handleDelete() {
    if (deleteConfirm.trim() !== project.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al borrar");
      }
      router.push("/proyectos");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al borrar");
      setDeleting(false);
    }
  }

  const progressPct = Math.round(Math.min((completed / total) * 100, 100));

  return (
    <>
      {/* Desktop: horizontal row */}
      <div className="hidden md:block group rounded-xl border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-slate-600">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>

          {/* Name + idea + current phase */}
          <div className="min-w-0 flex-1">
            <Link
              href={`/proyectos/${project.id}`}
              className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors truncate block"
            >
              {project.name}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              Idea: {project.idea.title || project.idea.description?.slice(0, 60) || "Sin descripción"}
            </p>
            {currentPhaseLabel && (
              <p className="mt-0.5 text-xs text-slate-500">
                Fase actual: <span className="text-slate-300">{currentPhaseLabel}</span>
              </p>
            )}
          </div>

          {/* Status + progress */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
              {statusText} {completed}/{total}
            </span>
            <div className="flex items-center gap-2 w-28">
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-400">{progressPct}%</span>
            </div>
            <Link
              href={`/proyectos/${project.id}`}
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
            >
              {CTALabel} <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Menu ⋮ */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Menú del proyecto"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setShowDeleteModal(true);
                    setDeleteConfirm("");
                    setDeleteError(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="size-4" />
                  Eliminar proyecto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: compact card */}
      <div className="md:hidden rounded-xl border border-slate-700 bg-slate-900/50 p-4 transition-all">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={`/proyectos/${project.id}`}
              className="text-sm font-semibold text-white truncate block"
            >
              {project.name}
            </Link>
            <p className="text-xs text-slate-500 truncate">
              {project.idea.title || project.idea.description?.slice(0, 50) || "Sin descripción"}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-medium ${statusBadgeClass}`}>
                {statusText}
              </span>
              <span className="text-slate-500">{completed}/{total}</span>
              <span className="text-slate-600">{timeAgo(project.updatedAt)}</span>
              <span className="font-medium text-slate-400">{progressPct}%</span>
            </div>
            <div className="mt-2">
              <Link
                href={`/proyectos/${project.id}`}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
              >
                <CTAIcon className="size-3" />
                {CTALabel}
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/20 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Borrar proyecto
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Esto eliminará el proyecto y todas sus fases de forma permanente.
                <span className="block mt-1 text-slate-400">La idea original no se verá afectada.</span>
              </p>
              <p className="text-sm text-slate-400">
                Escribe <strong className="text-red-400">{project.name}</strong> para confirmar:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={project.name}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {deleteError && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" />
                  {deleteError}
                </span>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm !== project.name}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Borrando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Borrar proyecto
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
