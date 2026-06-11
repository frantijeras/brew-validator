"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  Info,
  RotateCw,
  Wrench,
} from "lucide-react";
import { getErrorMeta, formatErrorTimestamp } from "@/lib/phase-errors";

/* ══════════════════════════════════════════════════════════════════════
   Tipos — espejo de BridgeLogItem que devuelve el endpoint
   /api/projects/[id]/bridge-logs
   ══════════════════════════════════════════════════════════════════════ */

interface BridgeLogItem {
  id: string;
  createdAt: string;
  level: string;
  jobId: string | null;
  phaseId: string | null;
  agentName: string | null;
  errorType: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
  retryCount: number | null;
  resolutionAction: string | null;
  model: string | null;
  provider: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  schemaVersion: string | null;
}

/* ══════════════════════════════════════════════════════════════════════
   Mapas de presentación
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Texto legible en español para la acción de resolución que ejecutó el sistema.
 * El bridge guarda un código corto en `resolutionAction`; lo traducimos aquí.
 * Las claves coinciden con RESOLUTION_ACTION de @/lib/bridge-retry (fuente de
 * verdad) más las que escriben los webhooks de callback.
 */
const RESOLUTION_LABELS: Record<string, string> = {
  retry: "Reintento automático con espera (Backoff)",
  simplified_retry: "Reintento con prompt simplificado",
  autocorrected: "Corrección automática de la respuesta (JSON)",
  fallback: "Versión de contingencia cargada (Fallback)",
  reset_to_available: "Fase devuelta a disponible para reintento manual",
  queued: "Encolado por límite de peticiones (Rate limit)",
  alerted: "Alerta crítica disparada",
  logged: "Solo registrado, sin acción",
  idea_marked_failed: "Validación de idea marcada como fallida",
};

function resolutionLabel(action: string | null): string {
  if (!action) return "Sin acción registrada";
  return RESOLUTION_LABELS[action] ?? action;
}

/** Estilos por nivel del registro: error=rojo, warning=ámbar, info=azul. */
function levelStyles(level: string) {
  switch (level) {
    case "error":
      return {
        border: "border-red-500/30",
        bg: "bg-red-500/5",
        text: "text-red-400",
        iconBg: "bg-red-500/10",
        Icon: AlertCircle,
        label: "Error",
      };
    case "warning":
      return {
        border: "border-amber-500/30",
        bg: "bg-amber-500/5",
        text: "text-amber-400",
        iconBg: "bg-amber-500/10",
        Icon: AlertTriangle,
        label: "Aviso (Warning)",
      };
    default:
      return {
        border: "border-blue-500/30",
        bg: "bg-blue-500/5",
        text: "text-blue-400",
        iconBg: "bg-blue-500/10",
        Icon: Info,
        label: "Información",
      };
  }
}

/** Fecha y hora absolutas en español (es-ES). */
function absoluteTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* ══════════════════════════════════════════════════════════════════════
   Panel principal — acordeón expandible que hace fetch del historial
   ══════════════════════════════════════════════════════════════════════ */

interface ErrorHistoryPanelProps {
  projectId: string;
}

export function ErrorHistoryPanel({ projectId }: ErrorHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<BridgeLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bridge-logs?limit=50`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "No se pudo cargar el historial de errores");
      }
      const json = (await res.json()) as { logs: BridgeLogItem[] };
      setLogs(json.logs ?? []);
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el historial de errores",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Carga perezosa: sólo al abrir el acordeón la primera vez.
  useEffect(() => {
    if (open && !loaded && !loading) {
      void load();
    }
  }, [open, loaded, loading, load]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-800/30 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
            <History className="size-3.5" />
          </div>
          <div>
            <span className="text-sm font-medium text-white">
              Historial de errores del Bridge (Puente con las APIs de IA)
            </span>
            <p className="text-xs text-slate-500">
              Fallos registrados durante la ejecución de las fases.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`size-4 text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-800 px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
              <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{error}</p>
                <button
                  onClick={() => void load()}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <RotateCw className="size-3" />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                <History className="size-5" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                Sin errores registrados
              </p>
              <p className="text-xs text-slate-500 max-w-xs">
                Este proyecto no ha registrado ningún fallo del Bridge (Puente
                con las APIs de IA). Todo en orden.
              </p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <ul className="space-y-3">
              {logs.map((log) => (
                <ErrorLogItem key={log.id} log={log} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Fila individual de error
   ══════════════════════════════════════════════════════════════════════ */

function ErrorLogItem({ log }: { log: BridgeLogItem }) {
  const [showTelemetry, setShowTelemetry] = useState(false);
  const styles = levelStyles(log.level);
  const meta = getErrorMeta(log.errorType);
  const { Icon } = styles;

  const hasTelemetry =
    log.model !== null ||
    log.provider !== null ||
    log.latencyMs !== null ||
    log.tokensIn !== null ||
    log.tokensOut !== null ||
    log.httpStatus !== null;

  return (
    <li
      className={`rounded-lg border ${styles.border} ${styles.bg} px-4 py-3`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-7 items-center justify-center rounded-lg ${styles.iconBg} ${styles.text} shrink-0`}
        >
          <Icon className="size-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Cabecera: etiqueta de tipo + nivel + hora */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">
              {meta.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles.iconBg} ${styles.text}`}
            >
              {styles.label}
            </span>
          </div>

          {/* Descripción del tipo de error */}
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {meta.description}
          </p>

          {/* Mensaje crudo del proveedor, si lo hay */}
          {log.errorMessage && (
            <p className="mt-1.5 text-xs text-slate-500 break-words font-mono">
              {log.errorMessage}
            </p>
          )}

          {/* Hora: relativa + absoluta */}
          <p className="mt-2 text-[11px] text-slate-500">
            <span title={absoluteTimestamp(log.createdAt)}>
              {formatErrorTimestamp(log.createdAt)}
            </span>
            <span className="text-slate-600"> · {absoluteTimestamp(log.createdAt)}</span>
          </p>

          {/* Metadatos de resolución: reintentos + acción ejecutada */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <RotateCw className="size-3 text-slate-500" />
              Reintentos realizados:{" "}
              <span className="text-slate-300 font-medium">
                {log.retryCount ?? 0}
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Wrench className="size-3 text-slate-500" />
              Acción ejecutada:{" "}
              <span className="text-slate-300 font-medium">
                {resolutionLabel(log.resolutionAction)}
              </span>
            </span>
            {log.agentName && (
              <span>
                Agente:{" "}
                <span className="text-slate-300 font-medium">
                  {log.agentName}
                </span>
              </span>
            )}
          </div>

          {/* Telemetría técnica colapsable */}
          {hasTelemetry && (
            <div className="mt-2.5">
              <button
                onClick={() => setShowTelemetry((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                aria-expanded={showTelemetry}
              >
                <ChevronDown
                  className={`size-3 transition-transform ${showTelemetry ? "rotate-180" : ""}`}
                />
                Telemetría técnica
              </button>

              {showTelemetry && (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] sm:grid-cols-3">
                  <TelemetryField label="Modelo" value={log.model} />
                  <TelemetryField label="Proveedor" value={log.provider} />
                  <TelemetryField
                    label="Latencia (ms)"
                    value={log.latencyMs !== null ? String(log.latencyMs) : null}
                  />
                  <TelemetryField
                    label="Tokens entrada"
                    value={log.tokensIn !== null ? String(log.tokensIn) : null}
                  />
                  <TelemetryField
                    label="Tokens salida"
                    value={log.tokensOut !== null ? String(log.tokensOut) : null}
                  />
                  <TelemetryField
                    label="HTTP (Protocolo de transferencia)"
                    value={log.httpStatus !== null ? String(log.httpStatus) : null}
                  />
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function TelemetryField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500 uppercase tracking-wider text-[9px]">
        {label}
      </dt>
      <dd className="text-slate-300 font-medium truncate">
        {value ?? "—"}
      </dd>
    </div>
  );
}
