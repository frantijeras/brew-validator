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
  ArrowRight,
  Eye,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  const { showInfo, showError } = useToast();
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [generated, setGenerated] = useState<GeneratedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<GeneratedSkill | null>(null);
  // Guard para que la generación automática ocurra una sola vez por montaje.
  const autoGenRef = useRef(false);

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

  // ── Regenerar TODAS las skills usando estrictamente las plantillas base ──
  const regenerateAll = useCallback(async () => {
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
      showInfo(`Skills regeneradas: ${data.skills?.length ?? 0}`);
      onHandoffReady?.();
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error al regenerar skills");
    } finally {
      setGenerating(false);
    }
  }, [projectId, skills, showInfo, showError, onHandoffReady, router]);

  // ── Generación automática al finalizar el roadmap ──
  // Esta sección solo es accesible cuando TODAS las fases están completadas. Si
  // al llegar aquí aún no hay skills generadas, se generan desde plantilla (una vez).
  useEffect(() => {
    if (loading || generating || autoGenRef.current) return;
    if (skills.length > 0 && generated.length === 0) {
      autoGenRef.current = true;
      regenerateAll();
    }
  }, [loading, generating, skills, generated, regenerateAll]);

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
        <Button variant="secondary" onClick={regenerateAll} loading={generating}>
          {!generating && <Sparkles className="size-4" />}
          {generating ? "Regenerando..." : "Regenerar todas con plantillas"}
        </Button>
        <Button
          variant="primary"
          onClick={() => onContinue?.()}
          disabled={generating || generated.length === 0}
          title={
            generated.length === 0 ? "Disponible cuando las skills estén generadas" : ""
          }
        >
          Continuar
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* Preview del markdown ("Ver la Skill") */}
      <Modal
        open={!!previewSkill}
        onClose={() => setPreviewSkill(null)}
        title={previewSkill?.name}
        size="lg"
        tall
      >
        <div
          className="markdown-body prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(previewSkill?.content || "") }}
        />
      </Modal>
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
  const isGenerated = !!generated && !!generated.content;

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
        {isGenerated ? (
          <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            Desde plantilla
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Pendiente
          </span>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => generated && onView(generated)}
        disabled={!isGenerated}
      >
        <Eye className="size-3.5" /> Ver la Skill
      </Button>
    </div>
  );
}
