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
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface SkillData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  confidence: number;
  reason: string;
  recommended: boolean;
  selected: boolean;
  custom: boolean;
}

type SkillState = SkillData & {
  _localSelected: boolean;
};

interface SkillSelectorProps {
  projectId: string;
  initialSkills?: { id: string; selected?: boolean; custom?: boolean }[];
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
};

const ICON_OPTIONS = [
  { value: "Code", label: "Code" },
  { value: "PenLine", label: "PenLine" },
  { value: "Search", label: "Search" },
  { value: "Mail", label: "Mail" },
  { value: "Share2", label: "Share2" },
  { value: "BarChart3", label: "BarChart3" },
  { value: "HeartHandshake", label: "HeartHandshake" },
  { value: "Target", label: "Target" },
  { value: "Users", label: "Users" },
  { value: "Palette", label: "Palette" },
  { value: "Scale", label: "Scale" },
  { value: "DollarSign", label: "DollarSign" },
];

// ── Component ─────────────────────────────────────────────────────────

export function SkillSelector({ projectId, initialSkills, onHandoffReady }: SkillSelectorProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const initialSkillsRef = useRef(initialSkills);

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
      const apiSkills: SkillData[] = data.skills ?? [];

      // Merge with existing selections if initialSkills provided
      const capturedInitial = initialSkillsRef.current;
      const merged = apiSkills.map((s) => {
        const existing = capturedInitial?.find((es: { id: string }) => es.id === s.id);
        return {
          ...s,
          _localSelected: existing
            ? (existing.selected as boolean | undefined) ?? (s.recommended && s.confidence >= 0.7)
            : s.recommended && s.confidence >= 0.7,
        };
      });

      setSkills(merged);

      // Notify other tabs (Export) that skills data may have changed
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar skills");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Auto-load skills on mount
  useEffect(() => {
    if (initialSkills && initialSkills.length > 0) {
      // Pre-populate from server-rendered data
      const merged = (initialSkills as SkillData[]).map((s) => ({
        ...s,
        _localSelected: (s.selected as boolean | undefined) ?? (s.recommended && s.confidence >= 0.7),
      }));
      setSkills(merged);
    } else {
      // Auto-fetch skills from API
      fetchSkills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle skill selection ───────────────────────────────────────

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, _localSelected: !s._localSelected } : s,
      ),
    );
  };

  // ── Add custom skill ─────────────────────────────────────────────

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

    setSkills((prev) => [...prev, newSkill]);
    setCustomName("");
    setCustomDescription("");
    setCustomIcon("Plus");
    setShowCustomForm(false);
  };

  // ── Save selection ───────────────────────────────────────────────

  const saveSkills = async () => {
    try {
      setSaving(true);
      const selected = skills
        .filter((s) => s._localSelected)
        .map(({ _localSelected, ...rest }) => ({
          ...rest,
          selected: true,
        }));

      const res = await fetch(`/api/projects/${projectId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}` + (data.details ? `: ${JSON.stringify(data.details)}` : ''));
      }

      setToast("Skills guardadas");
      setTimeout(() => setToast(null), 3000);

      // Notify sidebar and other tabs
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Error al guardar skills");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ── Generate skills (POST /skills/generate) ──────────────────────

  const generateSkills = async () => {
    try {
      setGenerating(true);
      const selectedIds = skills.filter((s) => s._localSelected).map((s) => s.id);

      if (selectedIds.length === 0) {
        setToast("Selecciona al menos una skill");
        setTimeout(() => setToast(null), 3000);
        setGenerating(false);
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: selectedIds, mode: "all" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();

      // Save the skills selection too
      await saveSkills();

      setToast(`Skills generadas: ${data.skills?.length ?? 0}`);
      setTimeout(() => setToast(null), 3000);

      // Unlock handoff tab
      onHandoffReady?.();

      // Notify other tabs
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Error al generar skills");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setGenerating(false);
    }
  };

  // ── Skip skills (mark handoffReady) ──────────────────────────────

  const skipSkills = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/projects/${projectId}/skills/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [], mode: "all" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error ${res.status}`);
      }

      setToast("Skills saltadas — Hand-off desbloqueado");
      setTimeout(() => setToast(null), 3000);

      onHandoffReady?.();
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Error");
      setTimeout(() => setToast(null), 3000);
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
            {generating ? "Generando..." : "Crear Skills"}
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
  const barWidth = Math.round(skill.confidence * 100);
  const barColor =
    skill.confidence >= 0.7
      ? "bg-green-500"
      : skill.confidence >= 0.4
        ? "bg-amber-500"
        : "bg-slate-600";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 transition-colors hover:border-slate-700">
      {/* Row 1: checkbox + icon + name */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="size-4 shrink-0 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
        />
        <span className="text-slate-400">
          {iconComponent(skill.icon, "size-5")}
        </span>
        <span className="text-base font-bold text-white flex-1 min-w-0 truncate">
          {skill.name}
        </span>
      </div>

      {/* Row 2: Description */}
      <p className="text-xs text-slate-500">{skill.description}</p>

      {/* Row 3: Confidence bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 shrink-0">Confianza</span>
        <span className="text-[10px] text-slate-500 shrink-0">{barWidth}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Row 4: Reason — make it more prominent */}
      <p className="text-xs text-slate-300">
        <span className="text-amber-400 font-medium">💡 </span>
        {skill.reason}
      </p>
    </div>
  );
}
