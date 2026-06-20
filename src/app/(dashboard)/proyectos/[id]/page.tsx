import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ProjectTabs } from "./project-tabs";
import { ProjectHeaderMenu } from "./project-header-menu";
import { phaseDescription } from "@/lib/phase-descriptions";
import { getChosenLogoSvg } from "@/lib/identity-logo";
import { reapStuckProcesses } from "@/lib/bridge/reaper";

interface Props {
  params: Promise<{ id: string }>;
}


export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;

  // Auto-saneado (lazy): al abrir el proyecto, recupera cualquier fase/idea/skill
  // colgada cuyo job superó el timeout (bridge caído / sin callback). Best-effort.
  await reapStuckProcesses({ projectId: id }).catch(() => {});

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
        phases={project.phases.map((p) => {
          // Resuelve el SVG del logotipo elegido (3c) desde el historial de
          // sub-pasos, para incrustarlo en las 3 muestras de estilo visual (3d).
          const history =
            p.subStepHistory &&
            typeof p.subStepHistory === "object" &&
            !Array.isArray(p.subStepHistory)
              ? (p.subStepHistory as Record<
                  string,
                  { choice?: string; artifact?: { content?: string } | null }
                >)
              : null;
          const logoEntry = history?.logo;
          const chosenLogoSvg = logoEntry?.artifact?.content
            ? getChosenLogoSvg(logoEntry.artifact.content, logoEntry.choice)
            : null;
          return {
          id: p.id,
          type: p.type,
          label: p.label,
          // Descripción canónica por tipo (asegura texto actual en proyectos
          // antiguos y nuevos); fallback al valor guardado en BDD.
          description: phaseDescription(p.type, p.description),
          status: p.status,
          sortOrder: p.sortOrder,
          artifacts: p.artifacts as Array<{ title: string; type: string }> | null,
          questions: p.questions as Array<{ id: string; label: string; type: string }> | null,
          // Marca si el usuario YA respondió el quiz (respuestas persistidas).
          // Permite que el botón de una fase AVAILABLE-con-error reintente el
          // informe en vez de regenerar el cuestionario.
          hasAnswers: Boolean(
            p.answers &&
              typeof p.answers === "object" &&
              !Array.isArray(p.answers) &&
              Object.keys(p.answers as object).length > 0
          ),
          subStep: p.subStep,
          subStepOrder: p.subStepOrder,
          subStepArtifact: p.subStepArtifact as
            | { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> }
            | null,
          subStepChoice: p.subStepChoice,
          chosenLogoSvg,
          lastError: p.lastError as import("@/lib/phase-errors").PhaseError | null,
          // Momento del último cambio de estado (≈ entrada en PROCESSING):
          // alimenta el contador de tiempo en vivo de las tarjetas.
          updatedAt: p.updatedAt.toISOString(),
          };
        })}
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
