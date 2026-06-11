import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ProjectTabs } from "./project-tabs";
import { ProjectHeaderMenu } from "./project-header-menu";

interface Props {
  params: Promise<{ id: string }>;
}


export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      // Only the idea fields the page actually forwards to ProjectTabs.
      idea: {
        select: {
          title: true,
          description: true,
          problem: true,
          valueProposition: true,
          targetUser: true,
          monetization: true,
          businessModel: true,
          score: true,
          verdict: true,
          status: true,
        },
      },
      phases: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) notFound();

  const allCompleted = project.phases.every((p) => p.status === "COMPLETED");

  // Load existing skills selection from project
  const existingSkills = project.skills as Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    confidence: number;
    reason: string;
    recommended: boolean;
    selected?: boolean;
    custom?: boolean;
  }> | null;

  return (
    <div>
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        Volver a proyectos
      </Link>

      {/* Cabecera del proyecto con menú ⋮ */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-sm text-slate-400">
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
          </div>
        </div>

        {/* ⋮ Menú de 3 puntos */}
        <ProjectHeaderMenu projectId={project.id} projectName={project.name} />
      </div>

      {/* Tabs: Fases del Proyecto / Skills del Proyecto */}
      <ProjectTabs
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
          subStepOrder: p.subStepOrder,
          subStepArtifact: p.subStepArtifact as
            | { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> }
            | null,
          subStepChoice: p.subStepChoice,
          lastError: p.lastError as import("@/lib/phase-errors").PhaseError | null,
        }))}
        memory={project.memory as import("@/lib/project-memory").ProjectMemory | null}
        hasCompletedPhases={allCompleted}
        handoffReady={project.handoffReady ?? false}
        existingSkills={existingSkills}
        idea={project.idea ? {
          title: project.idea.title,
          description: project.idea.description,
          problem: project.idea.problem,
          valueProposition: project.idea.valueProposition,
          targetUser: project.idea.targetUser,
          monetization: project.idea.monetization,
          businessModel: project.idea.businessModel,
          score: project.idea.score,
          verdict: project.idea.verdict,
          status: project.idea.status,
        } : null}
      />
    </div>
  );
}
