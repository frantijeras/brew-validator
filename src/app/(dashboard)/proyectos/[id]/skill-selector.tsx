"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Code,
  Search,
  Mail,
  Share2,
  BarChart3,
  Target,
  DollarSign,
  Globe,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  ArrowRight,
  Eye,
  RefreshCw,
  Trash2,
  FileText,
  X,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";
import { getSkillOutputMeta } from "@/lib/skill-catalog";
import type { SkillData, GeneratedSkill } from "@/lib/skill-types";

const ICON_MAP: Record<string, React.ElementType> = {
  Code,
  Search,
  Mail,
  Share2,
  BarChart3,
  Target,
  DollarSign,
  Globe,
  Megaphone,
};

const categoryLabel: Record<string, string> = {
  desarrollo: "Desarrollo",
  marketing: "Marketing",
  operaciones: "Operaciones",
  legal: "Legal",
  finanzas: "Finanzas",
};

interface SkillSelectorProps {
  projectId: string;
  onHandoffReady?: () => void;
}

export function SkillSelector({ projectId, onHandoffReady }: SkillSelectorProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [generated, setGenerated] = useState<GeneratedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewSkill, setPreviewSkill] = useState<GeneratedSkill | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/skills`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setSkills((data.skills as SkillData[]) ?? []);
      setGenerated(Array.isArray(data.generated) ? (data.generated as GeneratedSkill[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar skills");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Generar TODAS las skills ────────────────────────────────────────
  const generateAll = async () => {
    const ids = skills.map((s) => s.id);
    if (ids.length === 0) return;
    try {
      setGenerating(true);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: ids, mode: "all" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      const data = await res.json();
      setGenerated((data.skills as GeneratedSkill[]) ?? []);
      flash(`Skills generadas: ${data.skills?.length ?? 0}`);
      onHandoffReady?.();
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al generar skills");
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSkill = async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [id], mode: "merge" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      const data = await res.json();
      setGenerated((data.skills as GeneratedSkill[]) ?? []);
      flash("Skill regenerada");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al regenerar");
    } finally {
      setBusyId(null);
    }
  };

  const removeGeneratedSkill = async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [id], mode: "remove" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      const data = await res.json();
      setGenerated((data.skills as GeneratedSkill[]) ?? []);
      flash("Skill quitada del paquete");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al quitar");
    } finally {
      setBusyId(null);
    }
  };

  // ── Mejorar con IA (Fase 2): encola job + sondea estado ─────────────
  const enhanceSkill = async (id: string) => {
    try {
      setBusyId(id);
      setGenerated((prev) =>
        prev.map((g) => (g.id === id ? { ...g, source: "ai-pending" } : g)),
      );
      const res = await fetch(`/api/projects/${projectId}/skills/${id}/enhance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      const { jobId } = await res.json();
      flash("Mejorando con IA… puede tardar 1-2 min");
      const started = Date.now();
      let done = false;
      while (Date.now() - started < 180_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const st = await fetch(`/api/jobs/${jobId}/status`).then((r) => r.json()).catch(() => null);
        if (st?.status === "COMPLETED") { done = true; break; }
        if (st?.status === "FAILED") {
          flash(st.error || "La mejora con IA fallo. Revisa el modelo del agente.");
          break;
        }
      }
      await fetchSkills();
      if (done) flash("Skill mejorada con IA");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al mejorar con IA");
      await fetchSkills();
    } finally {
      setBusyId(null);
    }
  };

  const skipSkills = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [], mode: "all" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`);
      setGenerated([]);
      flash("Skills saltadas — Hand-off desbloqueado");
      onHandoffReady?.();
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error");
    } finally {
      setGenerating(false);
    }
  };

  const Icon = (iconName: string, className?: string) => {
    const C = ICON_MAP[iconName] ?? Code;
    return <C className={className} />;
  };

  if (loading) {
    return (
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Skills del Proyecto</h2>
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-slate-800 rounded h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-2">Skills del Proyecto</h2>
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <h2 className="text-lg font-semibold text-white">Skills del Proyecto</h2>
      <p className="mt-1 mb-4 text-xs text-slate-500">
        Estas skills se incluyen en el Hand-off como guias accionables que referencian los
        documentos del proyecto. Cada una puede mejorarse con IA para un documento a medida.
      </p>

      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <SkillCard key={s.id} skill={s} iconComponent={Icon} />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateAll}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating
            ? "Generando..."
            : generated.length > 0
              ? "Regenerar todas"
              : `Generar las ${skills.length} skills`}
        </button>
        <button
          type="button"
          onClick={skipSkills}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          Saltar
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* ── Revisión: skills generadas (Ver / Mejorar IA / Regenerar / Quitar) ── */}
      {generated.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Skills generadas</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {generated.length}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Revisa el contenido antes de descargar el Hand-off. Puedes ver, mejorar con IA,
            regenerar o quitar cada skill.
          </p>
          <div className="flex flex-col gap-2">
            {generated.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-slate-400" />
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-white">
                  {g.name}
                </span>
                {g.source === "ai-pending" ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-300">
                    <Loader2 className="size-3 animate-spin" />
                    Generando IA…
                  </span>
                ) : (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      g.source === "ai" ? "bg-purple-500/15 text-purple-300" : "bg-slate-700/60 text-slate-300"
                    }`}
                  >
                    {g.source === "ai" ? "IA" : "Plantilla"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewSkill(g)}
                  disabled={g.source === "ai-pending" || !g.content}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-50"
                >
                  <Eye className="size-3.5" /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => enhanceSkill(g.id)}
                  disabled={busyId === g.id || g.source === "ai-pending"}
                  className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs text-purple-200 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
                  title="Generar a medida con IA (1-2 min)"
                >
                  <Sparkles className="size-3.5" /> Mejorar con IA
                </button>
                <button
                  type="button"
                  onClick={() => regenerateSkill(g.id)}
                  disabled={busyId === g.id || g.source === "ai-pending"}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-50"
                  title="Regenerar (plantilla)"
                >
                  {busyId === g.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={() => removeGeneratedSkill(g.id)}
                  disabled={busyId === g.id || g.source === "ai-pending"}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  title="Quitar del paquete"
                >
                  <Trash2 className="size-3.5" /> Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de previsualización del markdown */}
      {previewSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreviewSkill(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-sm font-semibold text-white truncate">{previewSkill.name}</h3>
              <button
                type="button"
                onClick={() => setPreviewSkill(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-5 py-4 markdown-body prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(previewSkill.content || "") }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skill Card (sin selección: solo nombre + categoria + "Que genera") ──

function SkillCard({
  skill,
  iconComponent,
}: {
  skill: SkillData;
  iconComponent: (iconName: string, className?: string) => React.ReactNode;
}) {
  const [showMeta, setShowMeta] = useState(false);
  const meta = getSkillOutputMeta(skill.id);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 flex items-center justify-center rounded-lg bg-slate-800 p-1.5 text-slate-300">
          {iconComponent(skill.icon, "size-5")}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-bold text-white leading-tight">{skill.name}</span>
          <span className="text-[10px] text-slate-500">{categoryLabel[skill.category] || skill.category}</span>
        </div>
        <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
          {meta.length}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{skill.description}</p>
      <div>
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          {showMeta ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Que genera
        </button>
        {showMeta && (
          <div className="mt-1.5 rounded-md border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[11px] text-slate-300 leading-relaxed">{meta.outputSummary}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {meta.sections.map((s, i) => (
                <li key={i} className="text-[10px] text-slate-500">· {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
