import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Lock, Sparkles, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { ProjectPhasesWithModal } from "./project-phases-with-modal";

interface Props {
  params: Promise<{ id: string }>;
}


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
            {project.phases.filter((p) => p.status === "COMPLETED").length + 1}/6 fases
          </span>

        </div>
      </div>

      {/* Fases */}
      <ProjectPhasesWithModal
        projectId={project.id}
        ideaId={project.ideaId}
        projectName={project.name}
        phases={project.phases.map((p) => ({
          id: p.id,
          type: p.type,
          label: p.label,
          description: p.description,
          status: p.status,
          sortOrder: p.sortOrder,
          artifacts: p.artifacts as Array<{ title: string; type: string }> | null,
          questions: p.questions as Array<{ id: string; label: string; type: string }> | null,
          subStep: p.subStep,
          subStepArtifact: p.subStepArtifact as
            | { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> }
            | null,
          subStepChoice: p.subStepChoice,
        }))}
      />
    </div>
  );
}
