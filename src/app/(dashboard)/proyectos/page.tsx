import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  ArrowRight,
  CheckCircle,
  Clock,
  HelpCircle,
  Play,
  Eye,
} from "lucide-react";

export const dynamic = "force-dynamic";

const avatarColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-500/20", text: "text-green-400" },
  processing: { bg: "bg-amber-500/20", text: "text-amber-400" },
  questioning: { bg: "bg-purple-500/20", text: "text-purple-400" },
  default: { bg: "bg-blue-500/20", text: "text-blue-400" },
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

export default async function ProyectosPage() {
  const projects = await prisma.project.findMany({
    include: {
      idea: true,
      phases: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Proyectos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {projects.length === 0
              ? "Tus ideas convertidas en proyectos ejecutables"
              : `${projects.length} proyecto${projects.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {projects.length > 0 && (
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-amber-400"
          >
            <Plus className="size-4" />
            Nuevo proyecto
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
          <FolderKanban className="size-12 text-slate-600" />
          <p className="mt-4 text-sm text-slate-500">No hay proyectos todavía</p>
          <p className="mt-1 text-xs text-slate-600">
            Completa una idea y conviértela en proyecto para empezar
          </p>
          <Link
            href="/ideas"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-amber-400"
          >
            <Plus className="size-4" />
            Crear desde una idea
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const total = project.phases.length + 1; // +1 for inherited Phase 00
            const completedPhases = project.phases.filter(
              (p) => p.status === "COMPLETED"
            ).length;
            const completed = 1 + completedPhases;
            const isProcessing = project.phases.some(
              (p) => p.status === "PROCESSING"
            );
            const isQuestioning = project.phases.some(
              (p) => p.status === "QUESTIONING"
            );
            const isAvailable = project.phases.some(
              (p) => p.status === "AVAILABLE"
            );
            const allDone = completed === total;

            const statusKey = allDone ? "completed" : isProcessing ? "processing" : isQuestioning ? "questioning" : "default";
            const avatarStyle = avatarColors[statusKey];

            let statusText: string;
            let statusBadgeClass: string;
            let CTAIcon: React.ElementType;
            let CTALabel: string;

            if (allDone) {
              statusText = "Completado";
              statusBadgeClass = "bg-green-500/10 text-green-400 border-green-500/30";
              CTAIcon = Eye;
              CTALabel = "Ver proyecto";
            } else if (isProcessing) {
              statusText = "Procesando…";
              statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              CTAIcon = Clock;
              CTALabel = "Ver";
            } else if (isQuestioning) {
              statusText = "Esperando respuestas";
              statusBadgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/30";
              CTAIcon = HelpCircle;
              CTALabel = "Responder";
            } else if (isAvailable) {
              statusText = "En progreso";
              statusBadgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/30";
              CTAIcon = Play;
              CTALabel = "Continuar";
            } else {
              statusText = "En progreso";
              statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              CTAIcon = Play;
              CTALabel = "Continuar";
            }

            const currentPhase = project.phases.find(
              (p) => p.status !== "COMPLETED" && p.status !== "LOCKED"
            );

            return (
              <div
                key={project.id}
                className="group rounded-xl border border-slate-700 bg-slate-900/50 p-5 transition-all hover:border-slate-600 hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold ${avatarStyle.bg} ${avatarStyle.text}`}
                  >
                    {project.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/proyectos/${project.id}`}
                        className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors truncate"
                      >
                        {project.name}
                      </Link>
                    </div>

                    {/* Idea origin */}
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      Idea: {project.idea.title || project.idea.description?.slice(0, 60) || "Sin descripción"}
                    </p>

                    {/* Status + phase count + time */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${statusBadgeClass}`}>
                        {statusText}
                      </span>
                      <span className="text-slate-500">
                        {completed}/{total} fases
                      </span>
                      <span className="text-slate-600">
                        {timeAgo(project.updatedAt)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            allDone ? "bg-green-500" : "bg-amber-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              (completed / total) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {Math.round(Math.min((completed / total) * 100, 100))}%
                      </span>
                    </div>

                    {/* Current phase */}
                    {currentPhase && (
                      <p className="mt-2 text-xs text-slate-500">
                        Fase actual: <span className="text-slate-300">{currentPhase.label}</span>
                      </p>
                    )}

                    {/* CTA */}
                    <div className="mt-3">
                      <Link
                        href={`/proyectos/${project.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-all hover:bg-amber-400"
                      >
                        <CTAIcon className="size-3.5" />
                        {CTALabel}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
