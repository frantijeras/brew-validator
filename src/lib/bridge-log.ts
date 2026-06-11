/**
 * Registro de eventos del Bridge (Puente con las APIs de IA) en la tabla
 * `BridgeLog`, y utilidades para extraer los campos estructurados que el
 * bridge daemon manda en los callbacks.
 *
 * Usado por ambos webhooks (agent-callback e project-phase-callback) para que
 * todo fallo quede trazado con su tipo, status HTTP, reintentos, modelo, etc.
 */

import { prisma } from "@/lib/db";

/** Datos para crear una fila de BridgeLog. Todos opcionales salvo el nivel. */
export interface BridgeLogInput {
  level?: "error" | "warning" | "info";
  jobId?: string | null;
  ideaId?: string | null;
  projectId?: string | null;
  phaseId?: string | null;
  agentName?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  httpStatus?: number | null;
  retryCount?: number | null;
  resolutionAction?: string | null;
  model?: string | null;
  provider?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
  /** Versión del esquema esperado del output (info técnica 3.3). */
  schemaVersion?: string | null;
}

/**
 * Escribe una fila en BridgeLog. Es BEST-EFFORT: nunca lanza. El logging no
 * debe romper el procesamiento del callback (si la tabla falla, lo dejamos en
 * consola y seguimos).
 */
export async function writeBridgeLog(input: BridgeLogInput): Promise<void> {
  try {
    await prisma.bridgeLog.create({
      data: {
        level: input.level ?? "error",
        jobId: input.jobId ?? null,
        ideaId: input.ideaId ?? null,
        projectId: input.projectId ?? null,
        phaseId: input.phaseId ?? null,
        agentName: input.agentName ?? null,
        errorType: input.errorType ?? null,
        // El mensaje crudo puede ser enorme; lo recortamos para no inflar la fila.
        errorMessage: input.errorMessage ? input.errorMessage.slice(0, 2000) : null,
        httpStatus: input.httpStatus ?? null,
        retryCount: input.retryCount ?? null,
        resolutionAction: input.resolutionAction ?? null,
        model: input.model ?? null,
        provider: input.provider ?? null,
        tokensIn: input.tokensIn ?? null,
        tokensOut: input.tokensOut ?? null,
        latencyMs: input.latencyMs ?? null,
        schemaVersion: input.schemaVersion ?? null,
      },
    });
  } catch (e) {
    console.error("[writeBridgeLog] no se pudo registrar el evento del bridge", e);
  }
}

/** Campos técnicos estructurados que puede mandar el bridge en un callback. */
export interface BridgeTelemetry {
  httpStatus: number | null;
  provider: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  retryCount: number | null;
}

const toNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/**
 * Extrae la telemetría estructurada del cuerpo de un callback del bridge.
 * Tolera ausencia de campos (bridge antiguo) devolviendo null en cada uno.
 */
export function extractBridgeTelemetry(body: Record<string, unknown>): BridgeTelemetry {
  return {
    httpStatus: toNum(body.httpStatus),
    provider: toStr(body.provider),
    model: toStr(body.model),
    tokensIn: toNum(body.tokensIn),
    tokensOut: toNum(body.tokensOut),
    latencyMs: toNum(body.latencyMs),
    retryCount: toNum(body.retryCount),
  };
}

/**
 * ¿El output de un job COMPLETED está vacío? (el modelo no devolvió nada
 * utilizable → caso "empty_response"). Cubre: null/undefined, string vacío,
 * objeto sin claves, u objeto cuyas claves son todas strings vacías.
 */
export function isEmptyOutput(output: unknown): boolean {
  if (output === null || output === undefined) return true;
  if (typeof output === "string") return output.trim().length === 0;
  if (typeof output === "object") {
    const entries = Object.entries(output as Record<string, unknown>);
    if (entries.length === 0) return true;
    // Vacío si ningún valor aporta contenido (todo strings vacías / null).
    return entries.every(([, v]) => {
      if (v === null || v === undefined) return true;
      if (typeof v === "string") return v.trim().length === 0;
      if (Array.isArray(v)) return v.length === 0;
      return false;
    });
  }
  return false;
}
