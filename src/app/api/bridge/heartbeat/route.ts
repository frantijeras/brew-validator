import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

/**
 * POST /api/bridge/heartbeat
 *
 * Called by the local bridge daemon on every poll (every ~10s) to signal
 * that it is alive. Vercel cannot reach 127.0.0.1:9090 (the bridge runs
 * on Fran's VPS, not in Vercel), so the bridge POSTs *out* to us and we
 * store the timestamp. The web app reads /api/bridge/status to know if
 * the bridge is alive (last heartbeat < 60s old).
 *
 * Body:
 *   { timestamp: number, uptime: number, lastJobAt: number | null }
 *
 * Persists a single row in the Setting table. Because the schema requires
 * a real `userId` (FK to User), we use the first admin user (or the
 * earliest-registered user as a fallback) as a stable "system" namespace.
 * Reads in /api/bridge/status use the same key to findFirst it.
 */

const HEARTBEAT_KEY = "bridge_heartbeat";

async function resolveSystemUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (admin) return admin.id;
  const any = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return any?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    // Solo el bridge (con su secreto) puede reportar estado del sistema.
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Body inválido: se esperaba un objeto JSON" },
        { status: 400 }
      );
    }

    const { timestamp, uptime, lastJobAt } = body as {
      timestamp?: unknown;
      uptime?: unknown;
      lastJobAt?: unknown;
    };

    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
      return NextResponse.json(
        { error: "Campo 'timestamp' inválido: se esperaba un número (epoch seconds)" },
        { status: 400 }
      );
    }

    const userId = await resolveSystemUserId();
    if (!userId) {
      // No users yet — silently accept so the bridge flow isn't broken
      return NextResponse.json({ ok: true, stored: false });
    }

    const {
      state,
      stateDetail,
      currentAgent,
      currentModel,
      lastError,
      lastErrorAt,
      jobsCompleted,
      jobsFailed,
    } = body as {
      state?: unknown;
      stateDetail?: unknown;
      currentAgent?: unknown;
      currentModel?: unknown;
      lastError?: unknown;
      lastErrorAt?: unknown;
      jobsCompleted?: unknown;
      jobsFailed?: unknown;
    };

    const value = {
      timestamp,                          // bridge-reported time.time()
      uptime: typeof uptime === "number" && Number.isFinite(uptime) ? uptime : null,
      lastJobAt:
        typeof lastJobAt === "number" && Number.isFinite(lastJobAt)
          ? lastJobAt
          : null,
      lastSeenAt: new Date().toISOString(), // server-side stamp
      // Live state from the bridge (what it's doing right now)
      state: typeof state === "string" ? state : "idle",
      stateDetail: typeof stateDetail === "string" ? stateDetail : "",
      currentAgent: typeof currentAgent === "string" ? currentAgent : "",
      currentModel: typeof currentModel === "string" ? currentModel : "",
      lastError: typeof lastError === "string" ? lastError : "",
      lastErrorAt: typeof lastErrorAt === "number" && Number.isFinite(lastErrorAt) ? lastErrorAt : null,
      jobsCompleted: typeof jobsCompleted === "number" ? jobsCompleted : 0,
      jobsFailed: typeof jobsFailed === "number" ? jobsFailed : 0,
    };

    await prisma.setting.upsert({
      where: { key_userId: { key: HEARTBEAT_KEY, userId } },
      create: { key: HEARTBEAT_KEY, userId, value },
      update: { value },
    });

    return NextResponse.json({ ok: true, lastSeenAt: value.lastSeenAt });
  } catch (error) {
    // Best-effort endpoint — log but don't crash the bridge's flow.
    console.error("[POST /api/bridge/heartbeat]", error);
    return NextResponse.json(
      { error: "Error al registrar el heartbeat" },
      { status: 500 }
    );
  }
}
