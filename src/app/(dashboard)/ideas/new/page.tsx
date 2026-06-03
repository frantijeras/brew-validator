"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewIdeaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    targetUser: "",
    monetization: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (form.title.trim().length < 3) {
      newErrors.title = "Mínimo 3 caracteres";
    }
    if (form.description.trim().length < 10) {
      newErrors.description = "Mínimo 10 caracteres";
    }
    if (form.targetUser.trim().length < 3) {
      newErrors.targetUser = "Indica quién es tu usuario objetivo";
    }
    if (form.monetization.trim().length < 3) {
      newErrors.monetization = "Describe tu modelo de monetización";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");

    if (!validate()) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear la idea");
      }

      const idea = await res.json();
      router.push(`/ideas/${idea.id}`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al crear la idea");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/ideas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon />
          Volver a ideas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white">Nueva idea</h1>
        <p className="mt-1 text-sm text-slate-400">
          Describe tu idea de negocio y los agentes IA la validarán por ti.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {apiError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {apiError}
          </div>
        )}

        {/* Title */}
        <Field
          label="Título"
          name="title"
          placeholder="Ej: Una app de delivery para mascotas"
          value={form.title}
          onChange={handleChange}
          error={errors.title}
          maxLength={120}
        />

        {/* Description */}
        <Field
          label="Descripción"
          name="description"
          type="textarea"
          placeholder="Describe tu idea en detalle. ¿Qué problema resuelve? ¿Cómo funciona?"
          value={form.description}
          onChange={handleChange}
          error={errors.description}
          rows={4}
          maxLength={2000}
        />

        {/* Target user */}
        <Field
          label="Usuario objetivo"
          name="targetUser"
          placeholder="Ej: Dueños de mascotas entre 25-45 años en zonas urbanas"
          value={form.targetUser}
          onChange={handleChange}
          error={errors.targetUser}
          maxLength={200}
        />

        {/* Monetization */}
        <Field
          label="Monetización"
          name="monetization"
          placeholder="Ej: Suscripción mensual + comisión por pedido"
          value={form.monetization}
          onChange={handleChange}
          error={errors.monetization}
          maxLength={200}
        />

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Spinner />
                Creando…
              </>
            ) : (
              "Crear idea"
            )}
          </button>
          <Link
            href="/ideas"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

/* ── Internal components ── */

interface FieldProps {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: "input" | "textarea";
  rows?: number;
  maxLength?: number;
}

function Field({
  label,
  name,
  placeholder,
  value,
  onChange,
  error,
  type = "input",
  rows = 3,
  maxLength,
}: FieldProps) {
  const baseClass =
    "w-full rounded-lg border bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50";

  const borderClass = error
    ? "border-red-500/50 focus:border-red-400"
    : "border-slate-700 focus:border-amber-500/50";

  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-sm font-medium text-slate-300"
      >
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          rows={rows}
          maxLength={maxLength}
          className={`${baseClass} ${borderClass} resize-y min-h-[100px]`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className={`${baseClass} ${borderClass}`}
        />
      )}
      <div className="mt-1 flex items-center justify-between">
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <span />
        )}
        {maxLength && (
          <span className="text-xs text-slate-500 tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
