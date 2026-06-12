"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, CheckCheck } from "lucide-react";

/**
 * NotificationBell — campanita del header con notificaciones in-app
 * (dentro de la aplicación).
 *
 * - Badge con el número de no leídas (unread).
 * - Al abrir, dropdown (desplegable) con las últimas notificaciones.
 * - Botón "marcar todas como leídas".
 * - Click en una notificación: la marca leída y, si tiene actionUrl,
 *   navega a ella.
 * - Polling (sondeo) ligero cada 45s para refrescar el contador.
 */

interface Notification {
  id: string;
  level: "error" | "warning" | "info" | string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 45_000; // 45s

// Color por nivel (level) de la notificación.
function levelClasses(level: string): string {
  switch (level) {
    case "error":
      return "border-l-red-500";
    case "warning":
      return "border-l-amber-500";
    default:
      return "border-l-sky-500";
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: { notifications: Notification[]; unreadCount: number } =
        await res.json();
      if (mountedRef.current) {
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      // best-effort: si falla la red, mantenemos el estado actual
    }
  }, []);

  // Fetch al montar + polling ligero.
  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  // Cerrar al hacer click fuera o pulsar Escape.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const markOne = useCallback(async (id: string) => {
    // Optimista: marcamos en local y ajustamos el contador.
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id }),
      });
    } catch {
      // si falla, el próximo polling corregirá el estado
    }
  }, []);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // el próximo polling corregirá el estado
    }
  }, []);

  const handleItemClick = useCallback(
    (n: Notification) => {
      if (!n.read) void markOne(n.id);
      if (n.actionUrl) {
        setOpen(false);
        router.push(n.actionUrl);
      }
    },
    [markOne, router]
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        aria-label="Notificaciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="size-5" strokeWidth={1.5} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white"
            aria-label={`${unread} sin leer`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full z-50 mb-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-sm font-semibold text-slate-200">
              Notificaciones
            </span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="size-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No tienes notificaciones.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={
                        "flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors hover:bg-slate-800/60 " +
                        levelClasses(n.level) +
                        (n.read ? " opacity-60" : " bg-slate-800/30")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-200">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="mt-1 size-2 shrink-0 rounded-full bg-amber-400" />
                        )}
                      </div>
                      <span className="line-clamp-2 text-xs text-slate-400">
                        {n.body}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {formatTime(n.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
