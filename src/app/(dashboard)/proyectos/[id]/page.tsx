import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Circle, Lock, Sparkles, FileText, Brain, Palette, TrendingUp, Code, FileDown } from "lucide-react";
import { notFound } from "next/navigation";
import { PhaseActionButton } from "./phase-action-button";

interface Props {
  params: Promise<{ id: string }>;
}

const phaseIcons: Record<string, React.ReactNode> = {
  IDENTITY: <Palette className="size-5" />,
  ANALYSIS: <TrendingUp className="size-5" />,
  CONTENT: <FileText className="size-5" />,
  DEVELOPMENT: <Code className="size-5" />,
  DOSSIER: <FileDown className="size-5" />,
};

const phaseColors: Record<string, string> = {
  IDENTITY: "text-purple-400 border-purple-500/30",
  ANALYSIS: "text-blue-400 border-blue-500/30",
  CONTENT: "text-amber-400 border-amber-500/30",
  DEVELOPMENT: "text-green-400 border-green-500/30",
  DOSSIER: "text-rose-400 border-rose-500/30",
};

const phaseBgColors: Record<string, string> = {
  IDENTITY: "bg-purple-500/10",
  ANALYSIS: "bg-blue-500/10",
  CONTENT: "bg-amber-500/10",
  DEVELOPMENT: "bg-green-500/10",
  DOSSIER: "bg-rose-500/10",
};

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      idea: true,
      phases: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) notFound();

  const allCompleted = project.phases.every((p) => p.status === "COMPLETED");

  return (
    <div>
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        Volver a proyectos
      </Link>

      {/* Cabecera del proyecto */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-2 text-sm text-slate-400 line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            allCompleted
              ? "bg-green-500/10 text-green-400"
              : "bg-amber-500/10 text-amber-400"
          }`}>
            {allCompleted ? "Completado" : "En progreso"}
          </span>
          <span className="text-xs text-slate-500">
            {project.phases.filter((p) => p.status === "COMPLETED").length}/{project.phases.length} fases
          </span>
          <span className="text-xs text-slate-600">•</span>
          <Link
            href={`/ideas/${project.ideaId}`}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Ver idea original →
          </Link>
        </div>
      </div>

      {/* Fases */}
      <div className="space-y-3">
        {project.phases.map((phase) => {
          const isLocked = phase.status === "LOCKED";
          const isCompleted = phase.status === "COMPLETED";
          const isAvailable = phase.status === "AVAILABLE";
          const artifacts = phase.artifacts as Array<{ title: string; type: string }> | null;

          return (
            <div
              key={phase.id}
              className={`rounded-xl border p-5 transition-all ${
                isLocked
                  ? "border-slate-800 bg-slate-900/30 opacity-50"
                  : isCompleted
                    ? "border-green-500/20 bg-green-950/10"
                    : `${phaseBgColors[phase.type] || "bg-slate-900/50"} border-slate-700 hover:border-slate-600`
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 shrink-0 ${
                    isCompleted
                      ? "text-green-400"
                      : isLocked
                        ? "text-slate-600"
                        : phaseColors[phase.type] || "text-slate-400"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="size-5" />
                    ) : isLocked ? (
                      <Lock className="size-5" />
                    ) : (
                      phaseIcons[phase.type] || <Sparkles className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-base font-semibold ${
                      isCompleted
                        ? "text-green-300"
                        : isLocked
                          ? "text-slate-500"
                          : "text-white"
                    }`}>
                      {phase.label}
                    </h3>
                    {phase.description && (
                      <p className={`mt-1 text-sm ${
                        isLocked ? "text-slate-600" : "text-slate-400"
                      }`}>
                        {phase.description}
                      </p>
                    )}

                    {/* Artefactos generados */}
                    {artifacts && artifacts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {artifacts.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300"
                          >
                            <FileText className="size-3" />
                            {a.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de acción */}
                {isAvailable && (
                  <PhaseActionButton
                    projectId={project.id}
                    phaseId={phase.id}
                    phaseType={phase.type}
                    label={phase.label}
                  />
                )}
                {isCompleted && (
                  <span className="shrink-0 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                    Completado
                  </span>
                )}
                {isLocked && (
                  <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-500">
                    Bloqueado
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
