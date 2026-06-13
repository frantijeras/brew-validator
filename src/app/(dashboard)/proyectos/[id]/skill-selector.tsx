"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Sparkles,
  Loader2,
  ArrowRight,
  Eye,
  X,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";
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
  /** Llamado tras (re)generar las skills para refrescar el estado del proyecto. */
  onHandoffReady?: () => void;
  /** "Continuar" → abrir la pestaña 4 (Hand-off). */
  onContinue?: () => void;
}

export function SkillSelector({ projectId, onHandoffReady, onContinue }: SkillSelectorProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [generated, setGenerated] = useState<GeneratedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<GeneratedSkill | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Guard para que la generación automática ocurra una sola vez por montaje.
  const autoGenRef = useRef(false);

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

  // ── Generación automática al finalizar el roadmap ──
  // Esta sección solo es accesible cuando TODAS las fases del proyecto están
  // completadas. Si al llegar aquí aún no hay skills generadas, se generan
  // automáticamente desde plantilla (una sola vez).
  useEffect(() => {
    if (loading || generating || autoGenRef.current) return;
    if (skills.length > 0 && generated.length === 0) {
      autoGenRef.current = true;
      regenerateAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, generating, skills, generated]);

  // ── Regenerar TODAS las skills usando estrictamente las plantillas base ──
  const regenerateAll = async () => {
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
      flash(`Skills regeneradas: ${data.skills?.length ?? 0}`);
      onHandoffReady?.();
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al regenerar skills");
    } finally {
      setGenerating(false);
    }
  };

  const Icon = (iconName: string, className?: string) => {
    const C = ICON_MAP[iconName] ?? Code;
    return <C className={className} />;
  };

  // Mapa id → skill generada (con su origen y contenido).
  const genById = new Map(generated.map((g) => [g.id, g]));

  if (loading) {
    return (
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Skills del Proyecto</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-slate-800 rounded-lg h-24" />
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
        Guías accionables que referencian los documentos del proyecto. Se generan automáticamente
        desde plantilla al completar el roadmap.
      </p>

      {/* Grid de skills: media fila en desktop (8 skills → 4 filas). */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {skills.map((s) => (
          <SkillCard
            key={s.id}
            skill={s}
            generated={genById.get(s.id)}
            iconComponent={Icon}
            onView={(g) => setPreviewSkill(g)}
          />
        ))}
      </div>

      {/* Acciones del roadmap */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={regenerateAll}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? "Regenerando..." : "Regenerar todas con plantillas"}
        </button>
        <button
          type="button"
          onClick={() => onContinue?.()}
          disabled={generating || generated.length === 0}
          title={
            generated.length === 0
              ? "Disponible cuando las skills estén generadas"
              : ""
          }
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Modal de previsualización del markdown ("Ver la Skill") */}
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

// ── Skill Card: título + categoría + badge de origen + "Ver la Skill" ──

function SkillCard({
  skill,
  generated,
  iconComponent,
  onView,
}: {
  skill: SkillData;
  generated?: GeneratedSkill;
  iconComponent: (iconName: string, className?: string) => React.ReactNode;
  onView: (g: GeneratedSkill) => void;
}) {
  const isAi = generated?.source === "ai";
  const isPending = generated?.source === "ai-pending";
  const isGenerated = !!generated && !!generated.content && !isPending;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 flex items-center justify-center rounded-lg bg-slate-800 p-1.5 text-slate-300">
          {iconComponent(skill.icon, "size-5")}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-bold text-white leading-tight">
            {skill.name}
          </span>
          <span className="text-[10px] text-slate-500">
            {categoryLabel[skill.category] || skill.category}
          </span>
        </div>
        {/* Badge de origen */}
        {isPending ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-300">
            <Loader2 className="size-3 animate-spin" />
            Generando IA…
          </span>
        ) : isGenerated ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isAi ? "bg-purple-500/15 text-purple-300" : "bg-slate-700/60 text-slate-300"
            }`}
          >
            {isAi ? "Mejorada con IA" : "Desde plantilla"}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Pendiente
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => generated && onView(generated)}
        disabled={!isGenerated}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Eye className="size-3.5" /> Ver la Skill
      </button>
    </div>
  );
}
