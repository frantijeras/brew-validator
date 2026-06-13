"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Code,
  PenLine,
  Search,
  Mail,
  Share2,
  BarChart3,
  HeartHandshake,
  Target,
  Users,
  Palette,
  Scale,
  DollarSign,
  Globe,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  ArrowRight,
  Eye,
  RefreshCw,
  Trash2,
  Rocket,
  Briefcase,
  Shield,
  Megaphone,
  FileText,
  Layout,
  TrendingUp,
  Handshake,
  ShoppingCart,
  LineChart,
  MonitorSmartphone,
  Wrench,
  Blocks,
  Zap,
} from "lucide-react";

import { renderMarkdown } from "@/components/markdown-renderer";
import { getSkillOutputMeta } from "@/lib/skill-catalog";
import type { SkillData, GeneratedSkill } from "@/lib/skill-types";

// ── Types ────────────────────────────────────────────────────────────

type SkillState = SkillData & {
  _localSelected: boolean;
};

interface SkillSelectorProps {
  projectId: string;
  onHandoffReady?: () => void;
}

// ── Icon map (Lucide icons by name) ──────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Code,
  PenLine,
  Search,
  Mail,
  Share2,
  BarChart3,
  HeartHandshake,
  Target,
  Users,
  Palette,
  Scale,
  DollarSign,
  Globe,
  Rocket,
  Briefcase,
  Shield,
  Megaphone,
  FileText,
  Layout,
  TrendingUp,
  Handshake,
  ShoppingCart,
  LineChart,
  MonitorSmartphone,
  Wrench,
  Blocks,
  Zap,
};

const ICON_OPTIONS = [
  { value: "Code", label: "Código (Code)" },
  { value: "PenLine", label: "Escritura (PenLine)" },
  { value: "Search", label: "Búsqueda (Search)" },
  { value: "Mail", label: "Email (Mail)" },
  { value: "Share2", label: "Social (Share2)" },
  { value: "BarChart3", label: "Analytics (BarChart)" },
  { value: "HeartHandshake", label: "Soporte (HeartHandshake)" },
  { value: "Target", label: "Ads (Target)" },
  { value: "Users", label: "Comunidad (Users)" },
  { value: "Palette", label: "Diseño (Palette)" },
  { value: "Scale", label: "Legal (Scale)" },
  { value: "DollarSign", label: "Finanzas (DollarSign)" },
  { value: "Globe", label: "Web (Globe)" },
  { value: "Rocket", label: "Lanzamiento (Rocket)" },
  { value: "Briefcase", label: "Negocio (Briefcase)" },
  { value: "Megaphone", label: "Marketing (Megaphone)" },
  { value: "LineChart", label: "Métricas (LineChart)" },
  { value: "Zap", label: "Productividad (Zap)" },
];

// ── Component ─────────────────────────────────────────────────────────

export function SkillSelector({ projectId, onHandoffReady }: SkillSelectorProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillState[]>([]);
  const [generated, setGenerated] = useState<GeneratedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewSkill, setPreviewSkill] = useState<GeneratedSkill | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom skill form state
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customIcon, setCustomIcon] = useState("Plus");

  // ── Fetch skills from API ─────────────────────────────────────────

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/skills`);
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data = await res.json();
      // El GET ya devuelve la forma PLANA SkillData + la selección persistida.
      const apiSkills: SkillData[] = data.skills ?? [];
      setSkills(apiSkills.map((s) => ({ ...s, _localSelected: s.selected === true })));
      setGenerated(Array.isArray(data.generated) ? (data.generated as GeneratedSkill[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar skills");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Auto-load skills on mount (el GET fusiona con lo guardado).
  useEffect(() => {
    fetchSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpia el timer de auto-guardado al desmontar.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Persistencia de la selección (auto-guardado debounced) ──────────
  // Guarda TODAS las skills con su flag `selected` (también las no
  // seleccionadas y las custom) para que el GET las fusione al recargar.
  const persistSelection = useCallback(
    async (list: SkillState[]) => {
      const payload = list.map(({ _localSelected, ...rest }) => ({
        ...rest,
        selected: _localSelected,
      }));
      try {
        await fetch(`/api/projects/${projectId}/skills`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skills: payload }),
        });
        window.dispatchEvent(new CustomEvent("project-changed"));
      } catch {
        /* silencioso: el siguiente cambio reintenta el guardado */
      }
    },
    [projectId],
  );

  const schedulePersist = useCallback(
    (list: SkillState[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistSelection(list), 600);
    },
    [persistSelection],
  );

  // ── Toggle (auto-guarda con debounce) ───────────────────────────────
  const toggleSkill = (id: string) => {
    setSkills((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, _localSelected: !s._localSelected } : s,
      );
      schedulePersist(next);
      return next;
    });
  };

  // ── Añadir skill personalizada (persiste de inmediato) ──────────────
  const addCustomSkill = () => {
    const trimmedName = customName.trim();
    if (!trimmedName) return;
    const newSkill: SkillState = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      description: customDescription.trim() || "Skill personalizada",
      icon: customIcon,
      category: "desarrollo",
      confidence: 1.0,
      reason: "Skill añadida manualmente",
      recommended: true,
      selected: true,
      custom: true,
      _localSelected: true,
    };
    setSkills((prev) => {
      const next = [...prev, newSkill];
      persistSelection(next);
      return next;
    });
    setCustomName("");
    setCustomDescription("");
    setCustomIcon("Plus");
    setShowCustomForm(false);
  };

  // ── Generar TODAS las seleccionadas (mode "all") ────────────────────
  const generateSkills = async () => {
    const selectedIds = skills.filter((s) => s._localSelected).map((s) => s.id);
    if (selectedIds.length === 0) {
      flash("Selecciona al menos una skill");
      return;
    }
    try {
      setGenerating(true);
      await persistSelection(skills);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: selectedIds, mode: "all" }),
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

  // ── Regenerar una skill (mode "merge") ──────────────────────────────
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

  // ── Quitar una skill generada (mode "remove") + deseleccionar ───────
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
      setSkills((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, _localSelected: false } : s,
        );
        persistSelection(next);
        return next;
      });
      flash("Skill quitada del paquete");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Error al quitar");
    } finally {
      setBusyId(null);
    }
  };

  // ── Saltar (desbloquea handoff sin generar) ─────────────────────────
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

  // ── Split skills ─────────────────────────────────────────────────

  const recommendedSkills = skills.filter((s) => s.confidence >= 0.4);
  const extraSkills = skills.filter((s) => s.confidence < 0.4);

  // ── Render ───────────────────────────────────────────────────────

  const IconComponent = (iconName: string, className?: string) => {
    const Icon = ICON_MAP[iconName] ?? Code;
    return <Icon className={className} />;
  };

  // ── Loading skeleton ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-4">
          Skills del Proyecto
        </h2>
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-slate-800 rounded h-16"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────

  if (error && skills.length === 0) {
    return (
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white mb-2">
          Skills del Proyecto
        </h2>
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-950/60 p-5">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white shadow-lg animate-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Skills del Proyecto
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          >
            <Plus className="size-3.5" />
            Añadir skill personalizada
          </button>
        </div>
      </div>

      {/* Custom skill form */}
      {showCustomForm && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">
              Nueva skill personalizada
            </span>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Nombre de la skill"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Descripción"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <select
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCustomSkill}
              disabled={!customName.trim()}
              className="self-end rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
        </div>
      )}

      {/* Recommended skills */}
      {recommendedSkills.length > 0 && (
        <>
          <p className="text-xs text-slate-500 mb-2">
            Skills recomendadas en base a las fases completadas, tipo de negocio y respuestas del cuestionario. La barra indica el nivel de confianza de la recomendación.
          </p>
          <div className="flex flex-col gap-2 mb-3">
            {recommendedSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              selected={skill._localSelected}
              onToggle={() => toggleSkill(skill.id)}
              iconComponent={IconComponent}
            />
          ))}
          </div>
        </>
      )}

      {/* Extra skills (collapsed) */}
      {extraSkills.length > 0 && (
        <div className="border-t border-slate-800 pt-3 mt-3">
          <button
            type="button"
            onClick={() => setShowExtra(!showExtra)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showExtra ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Ver {extraSkills.length} skills adicionales
          </button>

          {showExtra && (
            <div className="flex flex-col gap-2 mt-3">
              {extraSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  selected={skill._localSelected}
                  onToggle={() => toggleSkill(skill.id)}
                  iconComponent={IconComponent}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — no skills yet */}
      {skills.length === 0 && !loading && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-8 text-center">
          <p className="text-sm text-slate-400 mb-4">
            Cargando skills recomendadas...
          </p>
        </div>
      )}

      {/* Action buttons */}
      {skills.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={generateSkills}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating
              ? "Generando..."
              : generated.length > 0
                ? "Regenerar todas las seleccionadas"
                : "Generar skills seleccionadas"}
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
      )}

      {/* ── Revisión: skills generadas (Ver / Regenerar / Quitar) ── */}
      {generated.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              Skills generadas
            </h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {generated.length}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Revisa el contenido antes de descargar el Hand-off. Puedes ver,
            regenerar o quitar cada skill.
          </p>
          <div className="flex flex-col gap-2">
            {generated.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-slate-400" />
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-white">
                  {g.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    g.source === "ai"
                      ? "bg-purple-500/15 text-purple-300"
                      : "bg-slate-700/60 text-slate-300"
                  }`}
                >
                  {g.source === "ai" ? "IA" : "Plantilla"}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewSkill(g)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white"
                  title="Ver contenido"
                >
                  <Eye className="size-3.5" />
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => regenerateSkill(g.id)}
                  disabled={busyId === g.id}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white disabled:opacity-50"
                  title="Regenerar"
                >
                  {busyId === g.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Regenerar
                </button>
                <button
                  type="button"
                  onClick={() => removeGeneratedSkill(g.id)}
                  disabled={busyId === g.id}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  title="Quitar del paquete"
                >
                  <Trash2 className="size-3.5" />
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal de previsualización del markdown de una skill ── */}
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
              <h3 className="text-sm font-semibold text-white truncate">
                {previewSkill.name}
              </h3>
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
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(previewSkill.content || ""),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skill Card ────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: SkillState;
  selected: boolean;
  onToggle: () => void;
  iconComponent: (iconName: string, className?: string) => React.ReactNode;
}

function SkillCard({
  skill,
  selected,
  onToggle,
  iconComponent,
}: SkillCardProps) {
  const [showMeta, setShowMeta] = useState(false);
  const meta = getSkillOutputMeta(skill.id);
  const barWidth = Math.round(skill.confidence * 100);
  const barColor =
    skill.confidence >= 0.7
      ? "bg-green-500"
      : skill.confidence >= 0.4
        ? "bg-amber-500"
        : "bg-slate-600";

  const categoryLabel: Record<string, string> = {
    desarrollo: "Desarrollo",
    marketing: "Marketing",
    operaciones: "Operaciones",
    legal: "Legal",
    finanzas: "Finanzas",
  };

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3.5 transition-colors ${
      selected
        ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
        : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
    }`}>
      {/* Row 1: checkbox + icon + name + category badge */}
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="size-4 shrink-0 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
        />
        <div className={`shrink-0 flex items-center justify-center rounded-lg p-1.5 ${
          selected ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400"
        }`}>
          {iconComponent(skill.icon, "size-5")}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white block leading-tight truncate">
            {skill.name}
          </span>
          <span className="text-[10px] text-slate-500">
            {categoryLabel[skill.category] || skill.category}
          </span>
        </div>
        {skill.confidence >= 0.7 && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
            ★ Recomendada
          </span>
        )}
      </div>

      {/* Row 2: Description */}
      <p className="text-xs text-slate-400 leading-relaxed">{skill.description}</p>

      {/* Row 3: Confidence bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">{barWidth}%</span>
      </div>

      {/* Row 4: Reason */}
      <p className="text-xs text-slate-300 leading-relaxed">
        <span className="text-amber-400 font-medium">💡</span>{" "}
        {skill.reason}
      </p>

      {/* Row 5: "Basado en:" chips (condiciones cumplidas) */}
      {skill.matchedConditions && skill.matchedConditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Basado en:
          </span>
          {skill.matchedConditions.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Row 6: "Qué genera" (desplegable) */}
      <div>
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          {showMeta ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          Qué genera
          <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
            {meta.length}
          </span>
        </button>
        {showMeta && (
          <div className="mt-1.5 rounded-md border border-slate-800 bg-slate-900/50 p-2.5">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {meta.outputSummary}
            </p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {meta.sections.map((s, i) => (
                <li key={i} className="text-[10px] text-slate-500">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
