"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Archive, Trash2, Undo2, MoreHorizontal, Pencil } from "lucide-react";
import { getScoreColor } from "@/lib/translations";
import { ConfirmModal } from "@/components/confirm-modal";
import RenameModal from "@/components/rename-modal";

import { BUSINESS_MODELS } from "@/lib/business-models";

interface IdeaCardProps {
  idea: {
    id: string;
    title: string;
    status: string;
    validationStatus: string;
    verdict: string | null;
    score: number | null;
    businessModel: string | null;
    isFavorite: boolean;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  showArchive?: boolean;
  showDelete?: boolean;
  onDeleted?: () => void;
}

export function IdeaCard({
  idea,
  showArchive = true,
  showDelete = false,
  onDeleted,
}: IdeaCardProps) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(idea.isFavorite);
  const [isArchived, setIsArchived] = useState(idea.isArchived);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuUpward, setMenuUpward] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const toggleFavorite = useCallback(async () => {
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

  const toggleArchive = useCallback(async () => {
    const next = !isArchived;
    setIsArchived(next);
    try {
      await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isArchived: next }),
      });
      router.refresh();
    } catch {
      setIsArchived(!next);
    }
  }, [idea.id, isArchived, router]);

  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("[DELETE idea]", data.error || "Error al eliminar");
        setShowDeleteModal(false);
        return;
      }
      setShowDeleteModal(false);
      router.refresh();
      onDeleted?.();
    } catch (err) {
      console.error("[DELETE idea]", err);
      setShowDeleteModal(false);
    }
  }, [idea.id, onDeleted, router]);

  function onDeleteClick() {
    setShowMenu(false);
    setShowDeleteModal(true);
  }

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu((prev) => {
      if (!prev && menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 220;
        setMenuUpward(spaceBelow < menuHeight);
      }
      return !prev;
    });
  }, []);

  const closeMenu = useCallback(() => setShowMenu(false), []);

  const statusColor =
    idea.validationStatus === "RUNNING" || idea.status === "VALIDATING"
      ? "border-amber-500/40 bg-amber-500/5"
      : idea.validationStatus === "COMPLETED" || idea.validationStatus === "DONE"
        ? "border-slate-700"
        : "border-slate-800";

  const dateStr = new Date(idea.updatedAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <Link
        href={`/ideas/${idea.id}`}
        className={`block rounded-xl border p-5 transition-all hover:border-slate-600 hover:bg-slate-900/70 ${statusColor}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white leading-snug line-clamp-2">
                {idea.title}
              </h3>
              {idea.businessModel && (() => {
                const model = BUSINESS_MODELS.find((m) => m.value === idea.businessModel);
                return model ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-400 border-slate-700">
                    <span>{model.icon}</span>
                    <span>{model.label}</span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-400 border-slate-700">
                    {idea.businessModel}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isArchived && (
              <span className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium text-amber-400 bg-amber-500/10 border-amber-500/30">
                Archivada
              </span>
            )}
            {/* Score badge: numeric with color, no X/10 */}
            {idea.score !== null && (
              <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${getScoreColor(idea.score)}`}>
                {idea.score.toFixed(1)}
              </span>
            )}

            <div className="relative" ref={menuRef}>
              <button
                ref={menuButtonRef}
                onClick={openMenu}
                className="rounded-md p-1 leading-none transition-colors hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Más opciones"
                aria-label="Más opciones"
              >
                <MoreHorizontal className="size-4" />
              </button>

              {showMenu && (
                <div
                  className={
                    "absolute right-0 z-40 w-48 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1.5 " +
                    (menuUpward ? "bottom-full mb-1" : "top-full mt-1")
                  }
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite();
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <Heart
                      className={`size-4 ${isFavorite ? "text-red-400" : "text-slate-400"}`}
                      fill={isFavorite ? "currentColor" : "none"}
                    />
                    {isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                  </button>

                  {!isFavorite && (
                    isArchived ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleArchive();
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <Undo2 className="size-4 text-slate-400" />
                        Desarchivar
                      </button>
                    ) : showArchive ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleArchive();
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <Archive className="size-4 text-slate-400" />
                        Archivar
                      </button>
                    ) : null
                  )}

                  {/* Edit name */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeMenu();
                      setShowRenameModal(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <Pencil className="size-4 text-slate-400" />
                    Editar nombre
                  </button>

                  {/* Separator */}
                  <div className="my-1 border-t border-slate-700" />

                  {showDelete && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteClick();
                        closeMenu();
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span>Última actualización: {dateStr}</span>
            {isFavorite && <Heart className="size-3 text-red-400 shrink-0" fill="currentColor" />}
            {isArchived && <Archive className="size-3 text-amber-400 shrink-0" fill="currentColor" />}
          </span>
          {/* Subtle status text */}
          <span className="text-slate-500">
            {idea.status === "GENERATING" ? "generando" : idea.status === "DRAFT" ? "borrador" : idea.status === "VALIDATING" ? "validando" : idea.status === "COMPLETED" ? "completada" : idea.status === "REFINING" ? "puliendo" : idea.status === "FAILED" ? "error" : ""}
          </span>
        </div>
      </Link>

      <ConfirmModal
        open={showDeleteModal}
        title="Eliminar idea"
        message="¿Seguro que quieres eliminar esta idea? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      <RenameModal
        open={showRenameModal}
        ideaId={idea.id}
        currentTitle={idea.title}
        onClose={() => setShowRenameModal(false)}
        onRenamed={() => {
          setShowRenameModal(false);
          router.refresh();
        }}
      />
    </>
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
