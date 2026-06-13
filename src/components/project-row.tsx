"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Trash2 } from "lucide-react";
import { KebabMenu } from "@/components/kebab-menu";
import { DeleteConfirmModal } from "@/components/delete-confirm-modal";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function handleDelete() {
    const res = await fetch("/api/projects/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error al borrar");
    }
    // Avisar al sidebar (Recientes) para que se refresque sin recargar.
    window.dispatchEvent(new Event("project-changed"));
    router.push("/proyectos");
  }

  const progressPct = Math.round(Math.min((completed / total) * 100, 100));

  return (
    <>
      {/* ── Desktop: layout con grid 3 columnas ── */}
      <div className="hidden md:block group rounded-xl border border-slate-700/60 bg-slate-900/40 transition-all hover:border-slate-600 hover:bg-slate-900/60">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 p-4">
          {/* Col 1: Avatar */}
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold self-start ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>

          {/* Col 2: Info principal */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <Link
                href={`/proyectos/${project.id}`}
                className="text-[15px] font-semibold text-white group-hover:text-amber-400 transition-colors truncate"
              >
                {project.name}
              </Link>
              <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass}`}>
                {statusText}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              {currentPhaseLabel && (
                <span>
                  Fase: <span className="text-slate-400">{currentPhaseLabel}</span>
                </span>
              )}
              <span>{completed}/{total} fases</span>
              <span>{timeAgo(project.updatedAt)}</span>
            </div>
          </div>

          {/* Col 3: ⋮ arriba + progreso centrado + CTA abajo */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* ⋮ Menú arriba a la derecha */}
            <KebabMenu
              ariaLabel="Menú del proyecto"
              items={[
                {
                  label: "Eliminar proyecto",
                  icon: <Trash2 className="size-3.5" />,
                  danger: true,
                  onClick: () => setShowDeleteModal(true),
                },
              ]}
            />

            {/* Progreso centrado */}
            <div className="flex items-center gap-2.5 w-32">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-400 w-8 text-right">{progressPct}%</span>
            </div>

            {/* CTA abajo a la derecha con bordes */}
            <Link
              href={`/proyectos/${project.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
            >
              {CTALabel}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Móvil: card compacta ── */}
      <div className="md:hidden rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 transition-all">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/proyectos/${project.id}`}
                className="text-sm font-semibold text-white truncate"
              >
                {project.name}
              </Link>
              <span className={`shrink-0 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass}`}>
                {statusText}
              </span>
            </div>
            {currentPhaseLabel && (
              <p className="mt-0.5 text-xs text-slate-500 truncate">
                {currentPhaseLabel}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${allDone ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-400">{completed}/{total}</span>
              <span className="text-[11px] text-slate-600">{timeAgo(project.updatedAt)}</span>
            </div>
            <div className="mt-2.5">
              <Link
                href={`/proyectos/${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
              >
                {CTALabel}
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal confirmar borrado ── */}
      <DeleteConfirmModal
        open={showDeleteModal}
        title="Borrar proyecto"
        itemName={project.name}
        confirmLabel="Borrar proyecto"
        description={
          <>
            Esto eliminará el proyecto y todas sus fases de forma permanente.
            <span className="block mt-1 text-slate-400">
              La idea original no se verá afectada.
            </span>
          </>
        }
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
