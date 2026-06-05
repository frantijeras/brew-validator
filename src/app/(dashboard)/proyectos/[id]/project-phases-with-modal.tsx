"use client";

import { useState } from "react";
import {
  CheckCircle,
  Lock,
  Sparkles,
  FileText,
  Brain,
  Palette,
  TrendingUp,
  Code,
  FileDown,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { PhaseActionButton } from "./phase-action-button";
import { PhaseQuestionsModal } from "./phase-questions-modal";

interface PhaseData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  status: string;
  sortOrder: number;
  artifacts: Array<{ title: string; type: string }> | null;
  questions: Array<{ id: string; label: string; type: string }> | null;
}

interface ProjectPhasesWithModalProps {
  projectId: string;
  phases: PhaseData[];
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

export function ProjectPhasesWithModal({
  projectId,
  phases,
}: ProjectPhasesWithModalProps) {
  const [modalPhase, setModalPhase] = useState<PhaseData | null>(null);

  return (
    <>
      <div className="space-y-3">
        {phases.map((phase) => {
          const isLocked = phase.status === "LOCKED";
          const isCompleted = phase.status === "COMPLETED";
          const isAvailable = phase.status === "AVAILABLE";
          const isQuestioning = phase.status === "QUESTIONING";
          const isProcessing = phase.status === "PROCESSING";
          const artifacts = phase.artifacts as Array<{ title: string; type: string }> | null;
          const questions = phase.questions as Array<{ id: string; label: string; type: string }> | null;

          const hasQuestions = isQuestioning && questions && questions.length > 0;

          return (
            <div
              key={phase.id}
              className={`rounded-xl border p-5 transition-all ${
                isLocked
                  ? "border-slate-800 bg-slate-900/30 opacity-50"
                  : isCompleted
                    ? "border-green-500/20 bg-green-950/10"
                    : isProcessing
                      ? "border-amber-500/20 bg-amber-950/10"
                      : `${phaseBgColors[phase.type] || "bg-slate-900/50"} border-slate-700 hover:border-slate-600`
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 shrink-0 ${
                      isCompleted
                        ? "text-green-400"
                        : isLocked
                          ? "text-slate-600"
                          : isProcessing
                            ? "text-amber-400"
                            : phaseColors[phase.type] || "text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="size-5" />
                    ) : isLocked ? (
                      <Lock className="size-5" />
                    ) : isProcessing ? (
                      <RefreshCw className="size-5 animate-spin" />
                    ) : hasQuestions ? (
                      <HelpCircle className="size-5" />
                    ) : (
                      phaseIcons[phase.type] || <Brain className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`text-base font-semibold ${
                        isCompleted
                          ? "text-green-300"
                          : isLocked
                            ? "text-slate-500"
                            : "text-white"
                      }`}
                    >
                      {phase.label}
                    </h3>
                    {phase.description && (
                      <p
                        className={`mt-1 text-sm ${
                          isLocked ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
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

                {/* Status / Action */}
                {isAvailable && (
                  <PhaseActionButton
                    projectId={projectId}
                    phaseId={phase.id}
                    phaseType={phase.type}
                    label={phase.label}
                  />
                )}
                {hasQuestions && (
                  <button
                    onClick={() => setModalPhase(phase)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-amber-400"
                  >
                    <HelpCircle className="size-4" />
                    Responder preguntas
                  </button>
                )}
                {isProcessing && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                    <RefreshCw className="size-3 animate-spin" />
                    Procesando
                  </span>
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

      {/* Questions modal */}
      {modalPhase && (
        <PhaseQuestionsModal
          open={!!modalPhase}
          onClose={() => setModalPhase(null)}
          projectId={projectId}
          phaseId={modalPhase.id}
          phaseType={modalPhase.type}
          questions={(modalPhase.questions as Array<{ id: string; label: string; type: string }>) || []}
        />
      )}
    </>
  );
}
