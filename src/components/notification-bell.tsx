"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  level: string; // "error" | "warning" | "info"
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string | null;
};

const POLL_MS = 30_000;

function levelColor(level: string): string {
  switch (level) {
    case "error":
      return "bg-red-400";
    case "warning":
      return "bg-amber-400";
    default:
      return "bg-sky-400";
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "";
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "ahora";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `hace ${day} d`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // silencioso: el sondeo reintenta
    }
  }, []);

  // Sondeo periódico + carga inicial.
  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Al abrir, refrescamos para mostrar lo más reciente.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Cerrar al hacer clic fuera o pulsar Escape.
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

  const markAllRead = useCallback(async () => {
    // Optimista: marcamos en local y confirmamos con el servidor.
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // si falla, el próximo sondeo restaura el estado real
    } finally {
      load();
    }
  }, [load]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : "Notificaciones"
        }
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-4 text-slate-950"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Lista de notificaciones"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-200">
              Notificaciones
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded text-xs font-medium text-amber-400 transition-colors hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No tienes notificaciones
              </p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {items.map((n) => {
                  const inner = (
                    <div className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${levelColor(
                          n.level
                        )}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            n.read
                              ? "font-medium text-slate-300"
                              : "font-semibold text-slate-100"
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                      {!n.read && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400"
                          title="Sin leer"
                        />
                      )}
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.actionUrl ? (
                        <a
                          href={n.actionUrl}
                          className="block px-4 py-3 transition-colors hover:bg-slate-800/60 focus:outline-none focus-visible:bg-slate-800/60"
                        >
                          {inner}
                        </a>
                      ) : (
                        <div className="px-4 py-3">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
