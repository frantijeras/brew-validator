"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Lock, Download, FileText, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { ProjectPhasesWithModal } from "./project-phases-with-modal";
import { SkillSelector } from "./skill-selector";
import { ErrorHistoryPanel } from "./error-history-panel";
import type { ProjectMemory } from "@/lib/project-memory";
import { renderMarkdown } from "@/components/markdown-renderer";

import type { PhaseError } from "@/lib/phase-errors";

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
  lastError?: PhaseError | null;
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

interface IdeaData {
  title: string;
  description: string;
  problem: string | null;
  valueProposition: string | null;
  targetUser: string;
  monetization: string;
  businessModel: string | null;
  score: number | null;
  verdict: string | null;
  status: string;
}

interface ValidationReport {
  id: string;
  agentName: string;
  title: string;
  content: string;
  scorecard: string | null;
  verdict: string | null;
  createdAt: string;
}

interface ProjectTabsProps {
  projectId: string;
  ideaId: string;
  projectName: string;
  phases: PhaseData[];
  memory: ProjectMemory | null;
  hasCompletedPhases: boolean;
  handoffReady: boolean;
  existingSkills: SkillData[] | null;
  idea: IdeaData | null;
}

type Tab = "validation" | "phases" | "skills" | "handoff";

const AGENT_ORDER = ["advocate", "skeptic", "judge"];

export function ProjectTabs({
  projectId,
  ideaId,
  projectName,
  phases,
  memory,
  hasCompletedPhases,
  handoffReady,
  existingSkills,
  idea,
}: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("phases");
  const router = useRouter();

  // Auto-switch to Skills tab when all phases are completed
  const prevCompletedRef = useRef(hasCompletedPhases);
  useEffect(() => {
    if (hasCompletedPhases && !prevCompletedRef.current && activeTab === "phases") {
      setActiveTab("skills");
    }
    prevCompletedRef.current = hasCompletedPhases;
  }, [hasCompletedPhases, activeTab]);

  return (
    <div>
      {/* Barra de pestañas — underline style */}
      <div className="flex items-center gap-0 border-b border-slate-800 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("validation")}
          className={`
            relative shrink-0 px-4 py-3 text-sm font-medium transition-colors
            whitespace-nowrap
            ${
              activeTab === "validation"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }
          `}
        >
          1. Validación
        </button>

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
          2. Fases
        </button>

        <button
          onClick={() => {
            if (hasCompletedPhases) setActiveTab("skills");
          }}
          disabled={!hasCompletedPhases}
          title={!hasCompletedPhases ? "Disponible al completar todas las fases del proyecto" : ""}
          className={`
            relative shrink-0 px-4 py-3 text-sm font-medium transition-colors
            whitespace-nowrap inline-flex items-center gap-1.5
            ${
              activeTab === "skills"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }
            ${!hasCompletedPhases ? "opacity-40 cursor-not-allowed hover:text-slate-400" : ""}
          `}
        >
          {!hasCompletedPhases && <Lock className="size-3.5 shrink-0" />}
          3. Skills
        </button>

        <button
          onClick={() => {
            if (handoffReady) setActiveTab("handoff");
          }}
          disabled={!handoffReady}
          title={!handoffReady ? "Disponible cuando el proyecto esté listo para el Hand-off" : ""}
          className={`
            relative shrink-0 px-4 py-3 text-sm font-medium transition-colors
            whitespace-nowrap inline-flex items-center gap-1.5
            ${
              activeTab === "handoff"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-amber-500"
                : "text-slate-400 hover:text-slate-200"
            }
            ${!handoffReady ? "opacity-40 cursor-not-allowed hover:text-slate-400" : ""}
          `}
        >
          {!handoffReady && <Lock className="size-3.5 shrink-0" />}
          4. Hand-off
        </button>
      </div>

      {/* Contenido de pestaña activa */}
      {activeTab === "validation" && (
        <ValidationTab projectId={projectId} idea={idea} />
      )}

      {activeTab === "phases" && (
        <div className="space-y-6">
          <ProjectPhasesWithModal
            projectId={projectId}
            ideaId={ideaId}
            projectName={projectName}
            phases={phases}
            memory={memory}
          />
          {/* Feedback Capa 3 — historial de errores del Bridge del proyecto */}
          <ErrorHistoryPanel projectId={projectId} />
        </div>
      )}

      {activeTab === "skills" && (
        <Suspense fallback={<div className="animate-pulse bg-slate-800/50 rounded-xl h-48" />}>
          <SkillSelector
            projectId={projectId}
            initialSkills={existingSkills && existingSkills.length > 0 ? existingSkills : undefined}
            onHandoffReady={() => {
              router.refresh();
            }}
          />
        </Suspense>
      )}

      {activeTab === "handoff" && (
        <HandoffTab
          projectId={projectId}
          projectName={projectName}
          phases={phases}
          existingSkills={existingSkills}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Validation Tab
   ══════════════════════════════════════════════════════════════════════ */

function ValidationTab({
  projectId,
  idea,
}: {
  projectId: string;
  idea: IdeaData | null;
}) {
  const [reports, setReports] = useState<ValidationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/validation/view?format=json`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error || "Error al cargar la validación",
          );
        }
        const json = await res.json();
        if (!cancelled) {
          setReports(json.reports ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar la validación",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
      </div>
    );
  }

  const sortedReports = AGENT_ORDER
    .map((agent) => reports.find((r) => r.agentName === agent))
    .filter(Boolean) as ValidationReport[];

  const verdictColor =
    idea?.verdict === "VIABLE"
      ? "text-green-400 bg-green-500/10"
      : idea?.verdict === "NO_VIABLE"
        ? "text-red-400 bg-red-500/10"
        : "text-amber-400 bg-amber-500/10";

  const verdictIcon =
    idea?.verdict === "VIABLE" ? (
      <CheckCircle2 className="size-4" />
    ) : idea?.verdict === "NO_VIABLE" ? (
      <XCircle className="size-4" />
    ) : (
      <AlertTriangle className="size-4" />
    );

  const statusLabel =
    idea?.status === "COMPLETED"
      ? "Completada"
      : idea?.status === "VALIDATING"
        ? "En validación"
        : idea?.status === "FAILED"
          ? "Fallida"
          : idea?.status ?? "Desconocido";

  return (
    <div className="space-y-6">
      {/* Idea original */}
      {idea && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            Idea Original
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Título
              </span>
              <p className="text-sm text-white mt-0.5 font-medium">
                {idea.title}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Descripción
              </span>
              <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">
                {idea.description}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {idea.problem && (
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Problema
                  </span>
                  <p className="text-sm text-slate-300 mt-0.5">
                    {idea.problem}
                  </p>
                </div>
              )}
              {idea.valueProposition && (
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Propuesta de valor
                  </span>
                  <p className="text-sm text-slate-300 mt-0.5">
                    {idea.valueProposition}
                  </p>
                </div>
              )}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Target
                </span>
                <p className="text-sm text-slate-300 mt-0.5">
                  {idea.targetUser}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Monetización
                </span>
                <p className="text-sm text-slate-300 mt-0.5">
                  {idea.monetization}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Veredicto + Score */}
      {(idea?.verdict || idea?.score !== null) && (
        <div className="flex flex-wrap items-center gap-3">
          {idea?.verdict && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${verdictColor}`}
            >
              {verdictIcon}
              Veredicto: {idea.verdict === "VIABLE" ? "VIABLE" : idea.verdict === "NO_VIABLE" ? "NO VIABLE" : "PULIR IDEA"}
            </span>
          )}
          {idea?.score !== null && idea?.score !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              Score: {idea.score.toFixed(1)}/10
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400">
            Estado: {statusLabel}
          </span>
        </div>
      )}

      {/* Reports */}
      {error && reports.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">
            {error}
          </p>
        </div>
      ) : sortedReports.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Reportes de validación
          </h3>
          {sortedReports.map((report) => (
            <ValidationReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : null}

      {/* Download PDF */}
      {idea && (
        <a
          href={`/api/projects/${projectId}/validation/download`}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 hover:border-slate-600"
        >
          <Download className="size-4" />
          Descargar PDF de validación
        </a>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Validation Report Card
   ══════════════════════════════════════════════════════════════════════ */

function ValidationReportCard({ report }: { report: ValidationReport }) {
  const [open, setOpen] = useState(report.agentName === "judge");

  const agentLabel =
    report.agentName === "skeptic"
      ? "Escéptico"
      : report.agentName === "advocate"
        ? "Defensor"
        : report.agentName === "judge"
          ? "Juez"
          : report.agentName;

  const agentColor =
    report.agentName === "skeptic"
      ? "red"
      : report.agentName === "advocate"
        ? "emerald"
        : "amber";

  const htmlContent = renderMarkdown(report.content, report.agentName);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex size-7 items-center justify-center rounded-lg bg-${agentColor}-500/10 text-${agentColor}-400`}
          >
            <FileText className="size-3.5" />
          </div>
          <span className="text-sm font-medium text-white">
            {agentLabel}
          </span>
        </div>
        <svg
          className={`size-4 text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-800 px-5 py-4">
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-p:text-slate-300
              prose-strong:text-slate-200 prose-li:text-slate-300
              prose-a:text-amber-400 prose-code:text-amber-300
              prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Export Tab
   ══════════════════════════════════════════════════════════════════════ */

function HandoffTab({
  projectId,
  projectName,
  phases,
  existingSkills,
}: {
  projectId: string;
  projectName: string;
  phases: PhaseData[];
  existingSkills: SkillData[] | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const completedPhases = phases.filter((p) => p.status === "COMPLETED");
  const selectedSkills =
    existingSkills?.filter((s) => s.selected) ?? [];

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/projects/export?projectId=${projectId}`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Download button */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Descargar proyecto completo
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Genera un ZIP con todos los reportes, identidad y skills seleccionadas.
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50 shrink-0"
          >
            <Download className="size-4" />
            {downloading ? "Generando..." : "Descargar todo"}
          </button>
        </div>
      </div>

      {/* Fases */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">
          Fases del proyecto
        </h3>
        {completedPhases.length > 0 ? (
          <div className="space-y-2">
            {completedPhases.map((phase) => {
              const hasContent =
                (phase.type === "IDENTITY" &&
                  (phase.subStep === "final" || phase.subStep === "visual") &&
                  phase.subStepArtifact?.content) ||
                (phase.artifacts && phase.artifacts.length > 0 &&
                  phase.artifacts.some((a) => a.type === "markdown"));

              return (
                <div
                  key={phase.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
                >
                  <CheckCircle2 className="size-4 text-green-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {phase.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      Fase {phase.sortOrder}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {hasContent ? "Markdown incluido" : "Sin contenido"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Ninguna fase completada aún.
          </p>
        )}
      </div>

      {/* Skills */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">
          Skills seleccionadas
        </h3>
        {selectedSkills.length > 0 ? (
          <div className="space-y-2">
            {selectedSkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <FileText className="size-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {skill.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {skill.description}
                  </p>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {skill.category}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No hay skills seleccionadas.
          </p>
        )}
      </div>

      {/* Package structure preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">
          Estructura del paquete
        </h3>
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 font-mono text-xs text-slate-400 space-y-1">
          <div className="text-white font-medium">
            {projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}/
          </div>
          <div className="pl-3">├── README.md</div>
          {completedPhases.map((phase, i) => (
            <div key={phase.id} className="pl-3">
              {i === completedPhases.length - 1 && selectedSkills.length === 0 ? "└──" : "├──"}{' '}{String(phase.sortOrder).padStart(2, "0")}-{phase.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.md
            </div>
          ))}
          <div className="pl-3">└── skills/</div>
          {selectedSkills.length > 0 ? (
            selectedSkills.map((skill, i) => (
              <div key={skill.id} className="pl-6">
                {i === selectedSkills.length - 1 ? "└──" : "├──"}{' '}{skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.md
              </div>
            ))
          ) : (
            <div className="pl-6">└── README.md</div>
          )}
        </div>
      </div>
    </div>
  );
}
