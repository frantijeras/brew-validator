import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
 * Persists a single row in the Setting table under a global
 * (userId = "bridge") namespace. There is only one heartbeat at any
 * time, so we use a synthetic userId to bypass the @@unique([key, userId])
 * constraint without requiring a real user.
 */

// Synthetic userId used as a namespace for global (non-user) settings.
// The @@unique([key, userId]) constraint still applies, but a fixed
// synthetic userId guarantees a single row per key.
const BRIDGE_USER_ID = "bridge";

export async function POST(req: NextRequest) {
  try {
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

    const value = {
      timestamp,                          // bridge-reported time.time()
      uptime: typeof uptime === "number" && Number.isFinite(uptime) ? uptime : null,
      lastJobAt:
        typeof lastJobAt === "number" && Number.isFinite(lastJobAt)
          ? lastJobAt
          : null,
      lastSeenAt: new Date().toISOString(), // server-side stamp
    };

    await prisma.setting.upsert({
      where: { key_userId: { key: "bridge_heartbeat", userId: BRIDGE_USER_ID } },
      create: { key: "bridge_heartbeat", userId: BRIDGE_USER_ID, value },
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
