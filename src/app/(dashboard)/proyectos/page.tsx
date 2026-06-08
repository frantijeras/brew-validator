import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { ProjectRow } from "@/components/project-row";

export const dynamic = "force-dynamic";

const avatarColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-500/20", text: "text-green-400" },
  processing: { bg: "bg-amber-500/20", text: "text-amber-400" },
  questioning: { bg: "bg-purple-500/20", text: "text-purple-400" },
  default: { bg: "bg-blue-500/20", text: "text-blue-400" },
};

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
        <div className="flex flex-col gap-3">
          {projects.map((project) => {
            const total = project.phases.length + 1;
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

            const statusKey = allDone
              ? "completed"
              : isProcessing
                ? "processing"
                : isQuestioning
                  ? "questioning"
                  : "default";
            const avatarStyle = avatarColors[statusKey];

            let statusText: string;
            let statusBadgeClass: string;
            let CTALabel: string;

            if (allDone) {
              statusText = "Completado";
              statusBadgeClass = "bg-green-500/10 text-green-400 border-green-500/30";
              CTALabel = "Ver proyecto";
            } else if (isProcessing) {
              statusText = "Procesando…";
              statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              CTALabel = "Ver";
            } else if (isQuestioning) {
              statusText = "Esperando respuestas";
              statusBadgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/30";
              CTALabel = "Responder";
            } else if (isAvailable) {
              statusText = "En progreso";
              statusBadgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/30";
              CTALabel = "Continuar";
            } else {
              statusText = "En progreso";
              statusBadgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
              CTALabel = "Continuar";
            }

            const currentPhase = project.phases.find(
              (p) => p.status !== "COMPLETED" && p.status !== "LOCKED"
            );

            return (
              <ProjectRow
                key={project.id}
                project={{
                  id: project.id,
                  name: project.name,
                  updatedAt: project.updatedAt,
                  idea: {
                    title: project.idea.title,
                    description: project.idea.description,
                  },
                  phases: project.phases.map((p) => ({
                    status: p.status,
                    label: p.label,
                    sortOrder: p.sortOrder,
                  })),
                }}
                avatarStyle={avatarStyle}
                statusText={statusText}
                statusBadgeClass={statusBadgeClass}
                CTALabel={CTALabel}
                allDone={allDone}
                completed={completed}
                total={total}
                currentPhaseLabel={currentPhase?.label ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
