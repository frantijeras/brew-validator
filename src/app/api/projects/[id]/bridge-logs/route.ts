import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";

/**
 * GET /api/projects/[id]/bridge-logs
 *
 * Devuelve el historial de errores del Bridge (Puente con las APIs de IA) para
 * un proyecto, ordenado por fecha de creación descendente (lo más reciente
 * primero). Autenticado y verificando que el proyecto pertenece al usuario
 * (vía guardProject → project.idea.userId).
 *
 * Paginación simple opcional:
 *   ?limit  — nº máximo de registros a devolver (por defecto 50, máx 100).
 *   ?cursor — id del último BridgeLog ya recibido; devuelve los siguientes.
 *
 * Respuesta: { logs: BridgeLogItem[], nextCursor: string | null }
 */

/** Forma tipada de cada registro que expone el endpoint a la UI. */
export interface BridgeLogItem {
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);

    // Límite saneado: entero positivo acotado a [1, MAX_LIMIT].
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const cursor = url.searchParams.get("cursor");

    // Pedimos uno de más para saber si hay página siguiente.
    const rows = await prisma.bridgeLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        createdAt: true,
        level: true,
        jobId: true,
        phaseId: true,
        agentName: true,
        errorType: true,
        errorMessage: true,
        httpStatus: true,
        retryCount: true,
        resolutionAction: true,
        model: true,
        provider: true,
        tokensIn: true,
        tokensOut: true,
        latencyMs: true,
        schemaVersion: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const logs: BridgeLogItem[] = page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      level: row.level,
      jobId: row.jobId,
      phaseId: row.phaseId,
      agentName: row.agentName,
      errorType: row.errorType,
      errorMessage: row.errorMessage,
      httpStatus: row.httpStatus,
      retryCount: row.retryCount,
      resolutionAction: row.resolutionAction,
      model: row.model,
      provider: row.provider,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      latencyMs: row.latencyMs,
      schemaVersion: row.schemaVersion,
    }));

    return NextResponse.json({ logs, nextCursor });
  } catch (error) {
    // Un cursor inexistente provoca un error de Prisma; lo tratamos como 400.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Cursor de paginación inválido" },
        { status: 400 },
      );
    }
    console.error("GET /api/projects/[id]/bridge-logs error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
