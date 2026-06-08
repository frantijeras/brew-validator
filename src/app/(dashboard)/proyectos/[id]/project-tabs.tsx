"use client";

import { useState, Suspense } from "react";
import { ProjectPhasesWithModal } from "./project-phases-with-modal";
import { SkillSelector } from "./skill-selector";
import type { ProjectMemory } from "@/lib/project-memory";

interface PhaseData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  status: string;
  sortOrder: number;
  artifacts: Array<{ title: string; type: string }> | null;
  questions: Array<{ id: string; label: string; type: string }> | null;
  subStep: string | null;
  subStepOrder: number | null;
  subStepArtifact: {
    type?: "html" | "markdown";
    content?: string;
    options?: Array<{ value: string; label: string }>;
  } | null;
  subStepChoice: string | null;
}

interface SkillData {
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
}

interface ProjectTabsProps {
  projectId: string;
  ideaId: string;
  projectName: string;
  phases: PhaseData[];
  memory: ProjectMemory | null;
  hasCompletedPhases: boolean;
  existingSkills: SkillData[] | null;
}

type Tab = "phases" | "skills";

export function ProjectTabs({
  projectId,
  ideaId,
  projectName,
  phases,
  memory,
  hasCompletedPhases,
  existingSkills,
}: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("phases");

  return (
    <div>
      {/* Barra de pestañas — underline style */}
      <div className="flex items-center gap-0 border-b border-slate-800 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("phases")}
          className={`
            relative shrink-0 px-4 py-3 text-sm font-medium transition-colors
            whitespace-nowrap
            ${
              activeTab === "phases"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }
          `}
        >
          Fases del Proyecto
        </button>

        <button
          onClick={() => {
            if (hasCompletedPhases) setActiveTab("skills");
          }}
          disabled={!hasCompletedPhases}
          className={`
            relative shrink-0 px-4 py-3 text-sm font-medium transition-colors
            whitespace-nowrap
            ${
              activeTab === "skills"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }
            ${!hasCompletedPhases ? "opacity-40 cursor-not-allowed hover:text-slate-400" : ""}
          `}
        >
          Skills del Proyecto

        </button>
      </div>

      {/* Contenido de pestaña activa */}
      {activeTab === "phases" ? (
        <ProjectPhasesWithModal
          projectId={projectId}
          ideaId={ideaId}
          projectName={projectName}
          phases={phases}
          memory={memory}
        />
      ) : (
        <Suspense fallback={<div className="animate-pulse bg-slate-800/50 rounded-xl h-48" />}>
          <SkillSelector
            projectId={projectId}
            initialSkills={existingSkills && existingSkills.length > 0 ? existingSkills : undefined}
          />
        </Suspense>
      )}
    </div>
  );
}
