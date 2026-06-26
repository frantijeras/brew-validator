"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type RequestType = "ideas" | "projects" | "phase_undo" | "skills" | "handoff";
type RequestStatus = "pending" | "granted" | "dismissed";

interface LimitRequest {
  id: string;
  type: RequestType;
  status: RequestStatus;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string | null; email: string };
}

const TYPE_LABELS: Record<string, string> = {
  ideas: "Más ideas",
  projects: "Más proyectos",
  phase_undo: "Deshacer fase",
  skills: "Acceso a Skills",
  handoff: "Acceso a Hand-off",
  refine: "Más refinados",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { label: string; className: string }> = {
    pending: { label: "Pendiente", className: "bg-amber-500/10 text-amber-400" },
    granted: { label: "Concedida", className: "bg-emerald-500/10 text-emerald-400" },
    dismissed: { label: "Descartada", className: "bg-slate-700/60 text-slate-400" },
  };
  const { label, className } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function RequestsTable() {
  const [requests, setRequests] = useState<LimitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/limit-requests", { cache: "no-store" });
      if (!res.ok) throw new Error("No autorizado");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      setError("No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string, action: "grant" | "dismiss") {
    setResolvingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/limit-requests/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo resolver la solicitud");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo resolver la solicitud"
      );
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Solicitudes de ampliación
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Peticiones de los usuarios para ampliar sus límites o acceder a más
            secciones
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={load}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No hay solicitudes
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-800/60 align-middle hover:bg-slate-800/20"
              >
                <td className="px-3 py-3">
                  <p className="truncate font-medium text-white">
                    {r.user.name ?? "Sin nombre"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.user.email}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {TYPE_LABELS[r.type] ?? r.type}
                </td>
                <td className="px-3 py-3 text-slate-400">
                  {fmtDate(r.createdAt)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-3 text-right">
                  {r.status === "pending" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={resolvingId === r.id}
                        onClick={() => resolve(r.id, "dismiss")}
                      >
                        <X className="h-3.5 w-3.5" />
                        Descartar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={resolvingId === r.id}
                        onClick={() => resolve(r.id, "grant")}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Conceder
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600">
                      {fmtDate(r.resolvedAt)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
