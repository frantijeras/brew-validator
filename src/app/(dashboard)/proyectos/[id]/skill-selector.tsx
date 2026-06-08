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
  Save,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";

// ── Icon map ───────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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

// ── Types ──────────────────────────────────────────────────────────

interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  confidence: number;
  reason: string;
  recommended: boolean;
  custom?: boolean;
}

interface SavedSkill extends SkillItem {
  selected: boolean;
  custom: boolean;
}

interface SkillSelectorProps {
  projectId: string;
  initialSkills?: SkillItem[];
  onSave?: (skills: SavedSkill[]) => void;
}

// ── Category badge colors ──────────────────────────────────────────

const categoryStyles: Record<string, string> = {
  desarrollo: "bg-green-500/10 text-green-400 border-green-500/20",
  marketing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  operaciones: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  legal: "bg-red-500/10 text-red-400 border-red-500/20",
  finanzas: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const categoryLabels: Record<string, string> = {
  desarrollo: "Desarrollo",
  marketing: "Marketing",
  operaciones: "Operaciones",
  legal: "Legal",
  finanzas: "Finanzas",
};

// ── Component ──────────────────────────────────────────────────────

export function SkillSelector({
  projectId,
  initialSkills,
  onSave,
}: SkillSelectorProps) {
  const [skills, setSkills] = useState<SkillItem[]>(initialSkills || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customSkills, setCustomSkills] = useState<SavedSkill[]>([]);
  const [loading, setLoading] = useState(!initialSkills);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customIcon, setCustomIcon] = useState("Plus");

  // Fetch skills on mount if not provided
  useEffect(() => {
    if (initialSkills && initialSkills.length > 0) {
      setSkills(initialSkills);
      // Pre-select recommended skills
      const sel = new Set<string>();
      initialSkills.forEach((s) => {
        if (s.recommended) sel.add(s.id);
      });
      setSelectedIds(sel);
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/skills`);
        if (!res.ok) {
          console.error("Failed to load skills:", res.status);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setSkills(data.skills || []);
        const sel = new Set<string>();
        (data.skills || []).forEach(
          (s: SkillItem) => s.recommended && sel.add(s.id),
        );
        setSelectedIds(sel);
      } catch (err) {
        console.error("Error loading skills:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialSkills]);

  // Show toast
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Toggle a skill
  const toggleSkill = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Add custom skill
  const addCustomSkill = useCallback(() => {
    const name = customName.trim();
    const desc = customDesc.trim();
    if (!name) return;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSkill: SavedSkill = {
      id,
      name,
      description: desc || "Skill personalizada",
      icon: customIcon,
      category: "operaciones",
      confidence: 1,
      reason: "Skill personalizada (definida por el usuario)",
      recommended: true,
      selected: true,
      custom: true,
    };
    setCustomSkills((prev) => [...prev, newSkill]);
    setSelectedIds((prev) => new Set(prev).add(id));
    setCustomName("");
    setCustomDesc("");
    setCustomIcon("Plus");
    setShowCustomModal(false);
  }, [customName, customDesc, customIcon]);

  // Remove custom skill
  const removeCustomSkill = useCallback((id: string) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const allSaved: SavedSkill[] = [
        ...skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          icon: s.icon,
          category: s.category,
          confidence: s.confidence,
          reason: s.reason,
          recommended: s.recommended,
          selected: selectedIds.has(s.id),
          custom: false,
        })),
        ...customSkills,
      ];

      const res = await fetch(`/api/projects/${projectId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: allSaved }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      showToast("Seleccion de skills guardada correctamente");
      onSave?.(allSaved);
    } catch (err) {
      console.error("Error saving skills:", err);
      showToast(
        err instanceof Error ? err.message : "Error al guardar skills",
      );
    } finally {
      setSaving(false);
    }
  }, [projectId, skills, customSkills, selectedIds, showToast, onSave]);

  // ── Split skills ──
  const recommendedSkills = skills.filter((s) => s.recommended);
  const notRecommendedSkills = skills.filter((s) => !s.recommended);
  const totalSelected = selectedIds.size + customSkills.length;

  // ── Confidence bar helper ──
  function confidenceBar(pct: number) {
    let color: string;
    if (pct > 0.7) color = "bg-green-500";
    else if (pct >= 0.4) color = "bg-amber-500";
    else color = "bg-slate-500";
    return (
      <div className="h-1.5 w-full rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    );
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-800" />
        <div className="mb-4 h-4 w-72 animate-pulse rounded bg-slate-800" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (skills.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <Sparkles className="size-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Skills del Proyecto</h3>
        </div>
        <p className="text-sm text-slate-400">
          Completa las fases del proyecto para ver recomendaciones de skills.
        </p>
      </div>
    );
  }

  // ── Skill card ──
  function SkillCard({ skill, custom }: { skill: SkillItem | SavedSkill; custom?: boolean }) {
    const isSelected = selectedIds.has(skill.id);
    const IconComponent = iconMap[skill.icon] || Sparkles;

    return (
      <div
        className={`rounded-xl border p-4 transition-all ${
          isSelected
            ? "border-purple-500/30 bg-purple-500/5"
            : "border-slate-800 bg-slate-900/40"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              isSelected ? "bg-purple-500/20" : "bg-slate-800"
            }`}
          >
            <IconComponent
              className={`size-5 ${isSelected ? "text-purple-400" : "text-slate-400"}`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">
                {skill.name}
              </span>
              {"category" in skill && (
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    categoryStyles[skill.category] || categoryStyles.operaciones
                  }`}
                >
                  {categoryLabels[skill.category] || skill.category}
                </span>
              )}
              {custom && (
                <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  Custom
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{skill.description}</p>

            {/* Confidence bar */}
            <div className="mt-2">{confidenceBar(skill.confidence)}</div>

            {/* Reason */}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {skill.reason}
            </p>
          </div>

          {/* Toggle + Remove for custom */}
          <div className="flex items-center gap-1.5 shrink-0">
            {custom && "id" in skill ? (
              <button
                onClick={() => removeCustomSkill(skill.id)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Eliminar skill personalizada"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            <button
              onClick={() => toggleSkill(skill.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
                isSelected
                  ? "border-purple-500 bg-purple-500"
                  : "border-slate-600 bg-slate-700"
              }`}
              role="switch"
              aria-checked={isSelected}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  isSelected ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-slate-900 px-4 py-3 shadow-xl">
            <Check className="size-4 text-green-400" />
            <span className="text-sm text-slate-200">{toast}</span>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">
                Skills del Proyecto
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              El sistema recomienda estas {skills.length} skills basadas en tu
              proyecto. Selecciona las que quieras incluir en el ZIP de handoff.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-slate-500">
            {totalSelected} seleccionadas
          </span>
        </div>

        {/* Recommended skills (always visible) */}
        <div className="mt-4 space-y-2">
          {recommendedSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>

        {/* Not recommended — collapsible */}
        {notRecommendedSkills.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
            >
              {showAll ? (
                <>
                  <ChevronUp className="size-3.5" />
                  Ocultar skills no recomendadas
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  Ver skills no recomendadas ({notRecommendedSkills.length})
                </>
              )}
            </button>

            {showAll && (
              <div className="mt-2 space-y-2">
                {notRecommendedSkills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom skills */}
        {customSkills.length > 0 && (
          <div className="mt-2 space-y-2">
            {customSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} custom />
            ))}
          </div>
        )}

        {/* Add custom skill button */}
        <button
          onClick={() => setShowCustomModal(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-300"
        >
          <Plus className="size-3.5" />
          Anadir skill personalizada
        </button>

        {/* Save button */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Guardar seleccion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom skill modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-white">
                Skill personalizada
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Nombre de la skill
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej: CRM Manager"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Descripcion
                </label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Que hace esta skill?"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addCustomSkill}
                  disabled={!customName.trim()}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anadir
                </button>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
