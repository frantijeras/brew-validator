"use client";

import { useState, useEffect, useCallback } from "react";
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
  Plus,
  X,
  ChevronDown,
  ChevronUp,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialSkills?: any[];
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

// ── Helpers ───────────────────────────────────────────────────────────

function confidenceBadge(confidence: number) {
  if (confidence >= 0.7) {
    return "bg-green-500/15 text-green-400 border-green-500/20";
  }
  if (confidence >= 0.4) {
    return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  }
  return "bg-slate-500/15 text-slate-400 border-slate-500/20";
}

function confidencePct(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

// ── Component ─────────────────────────────────────────────────────────

export function SkillSelector({ projectId, initialSkills }: SkillSelectorProps) {
  const [skills, setSkills] = useState<SkillState[]>([]);
  const [loading, setLoading] = useState(!initialSkills);
  const [error, setError] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Custom skill form state
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customIcon, setCustomIcon] = useState("Plus");

  // ── Fetch skills from API ────────────────────────────────────────

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
      const merged = apiSkills.map((s) => {
        const existing = initialSkills?.find((es: { id: string }) => es.id === s.id);
        return {
          ...s,
          _localSelected: existing
            ? (existing.selected as boolean | undefined) ?? (s.recommended && s.confidence >= 0.7)
            : s.recommended && s.confidence >= 0.7,
        };
      });

      setSkills(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar skills");
    } finally {
      setLoading(false);
    }
  }, [projectId, initialSkills]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

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
        throw new Error(`Error ${res.status}`);
      }

      setToast("Skills guardadas");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast("Error al guardar skills");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
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
            Anadir skill personalizada
          </button>
          <button
            type="button"
            onClick={saveSkills}
            disabled={saving}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar seleccion"}
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
              placeholder="Descripcion"
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
              Anadir
            </button>
          </div>
        </div>
      )}

      {/* Recommended skills */}
      {recommendedSkills.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {recommendedSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              selected={skill._localSelected}
              onToggle={() => toggleSkill(skill.id)}
              iconComponent={IconComponent}
              confidenceBadge={confidenceBadge}
              confidencePct={confidencePct}
            />
          ))}
        </div>
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
                  confidenceBadge={confidenceBadge}
                  confidencePct={confidencePct}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {skills.length === 0 && !loading && (
        <p className="text-sm text-slate-500 py-4">
          No se detectaron skills para este proyecto. Completa mas fases para
          obtener recomendaciones.
        </p>
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
  confidenceBadge: (confidence: number) => string;
  confidencePct: (confidence: number) => string;
}

function SkillCard({
  skill,
  selected,
  onToggle,
  iconComponent,
  confidenceBadge,
  confidencePct,
}: SkillCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 transition-colors hover:border-slate-700">
      {/* Fila 1: Icono + nombre + badge + toggle */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400">
          {iconComponent(skill.icon, "size-5")}
        </span>
        <span className="text-sm font-semibold text-white flex-1">
          {skill.name}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${confidenceBadge(skill.confidence)}`}
        >
          {confidencePct(skill.confidence)}
        </span>
        {/* Toggle switch */}
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="peer sr-only"
          />
          <div
            className={`h-5 w-9 rounded-full transition-colors peer-focus:outline-none ${
              selected ? "bg-amber-600" : "bg-slate-700"
            }`}
          />
          <div
            className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform ${
              selected ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </label>
      </div>

      {/* Fila 2: Descripcion */}
      <p className="text-xs text-slate-500">{skill.description}</p>

      {/* Fila 3: Razon */}
      <p className="text-xs text-slate-600 italic">{skill.reason}</p>
    </div>
  );
}
