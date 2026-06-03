"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { translateVerdict, translateStatus } from "@/lib/translations";

interface IdeaCardProps {
  idea: {
    id: string;
    title: string;
    status: string;
    validationStatus: string;
    verdict: string | null;
    score: number | null;
    isFavorite: boolean;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export function IdeaCard({ idea }: IdeaCardProps) {
  const [isFavorite, setIsFavorite] = useState(idea.isFavorite);
  const [isArchived, setIsArchived] = useState(idea.isArchived);

  const toggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch {
      setIsFavorite(!next);
    }
  }, [idea.id, isFavorite]);

  const toggleArchive = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !isArchived;
    setIsArchived(next);
    try {
      await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isArchived: next }),
      });
    } catch {
      setIsArchived(!next);
    }
  }, [idea.id, isArchived]);

  const isDone = idea.verdict !== null;
  const verdictColor = idea.verdict === "GO"
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : idea.verdict === "PIVOT"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : idea.verdict === "KILL"
        ? "text-red-400 bg-red-500/10 border-red-500/30"
        : null;

  const statusColor =
    idea.status === "VALIDATING"
      ? "border-amber-500/40 bg-amber-500/5"
      : idea.status === "COMPLETED" || idea.status === "DONE"
        ? "border-slate-700"
        : "border-slate-800";

  const dateStr = new Date(idea.createdAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const badgeLabel = idea.verdict
    ? translateVerdict(idea.verdict)
    : translateStatus(idea.validationStatus || idea.status);

  return (
    <Link
      href={`/ideas/${idea.id}`}
      className={`block rounded-xl border p-5 transition-all hover:border-slate-600 hover:bg-slate-900/70 ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white leading-snug line-clamp-2">
          {idea.title}
        </h3>

        {/* Status badge */}
        <div className="flex shrink-0 items-center gap-2">
          {idea.validationStatus === "RUNNING" && (
            <Spinner />
          )}
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
              idea.validationStatus === "DONE" && idea.verdict
                ? verdictColor
                : idea.validationStatus === "DONE"
                  ? "text-slate-300 bg-slate-500/10 border-slate-500/30"
                  : idea.validationStatus === "RUNNING"
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    : "text-slate-400 bg-slate-500/10 border-slate-500/30"
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>{dateStr}</span>
        {isDone && idea.score !== null && (
          <span className="text-amber-400 font-semibold tabular-nums">
            {idea.score}/10
          </span>
        )}
        {idea.validationStatus === "RUNNING" && (
          <span className="text-amber-400">Validando…</span>
        )}
        {idea.validationStatus === "DONE" && !idea.verdict && (
          <span className="text-slate-400">Completado</span>
        )}
      </div>

      {/* Favorite / Archive toggles */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleFavorite}
          className="rounded-md p-1 text-lg leading-none transition-colors hover:bg-slate-800"
          title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>
        <button
          onClick={toggleArchive}
          className="rounded-md p-1 text-lg leading-none transition-colors hover:bg-slate-800"
          title={isArchived ? "Desarchivar" : "Archivar"}
          aria-label={isArchived ? "Desarchivar" : "Archivar"}
        >
          {isArchived ? "🗂️" : "📦"}
        </button>
      </div>
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin text-amber-400"
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
