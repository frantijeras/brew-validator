import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/bridge/status
 *
 * Public endpoint — read by the web app to know if the local bridge
 * daemon is alive. "Alive" means the last heartbeat POST landed here
 * less than 60s ago.
 *
 * Response shape (consumed by src/hooks/use-bridge-status.ts):
 *   {
 *     reachable: boolean,
 *     lastHeartbeatAt: string | null,   // ISO 8601
 *     ageSeconds: number | null,
 *     uptimeSeconds: number | null,
 *     lastJobAt: string | null,         // ISO 8601
 *     staleAfterSeconds: number         // always 60
 *   }
 *
 * - No row in DB                       → reachable: false, all null
 * - lastHeartbeatAt older than 60s     → reachable: false
 * - lastHeartbeatAt within 60s         → reachable: true
 *
 * The endpoint itself is best-effort: any error returns reachable: false
 * with `reason: "error"` so the UI can show a banner instead of
 * silently leaving the user wondering why jobs hang.
 */

const HEARTBEAT_KEY = "bridge_heartbeat";
const STALE_AFTER_SECONDS = 60;

type HeartbeatValue = {
  timestamp?: number;
  uptime?: number | null;
  lastJobAt?: number | null;
  lastSeenAt?: string;
};

export async function GET() {
  try {
    // The heartbeat is owned by the first admin / first user. We just
    // need the row, so findFirst is enough.
    const setting = await prisma.setting.findFirst({
      where: { key: HEARTBEAT_KEY },
    });

    if (!setting) {
      return NextResponse.json({
        reachable: false,
        reason: "no-heartbeat",
        lastHeartbeatAt: null,
        ageSeconds: null,
        uptimeSeconds: null,
        lastJobAt: null,
        staleAfterSeconds: STALE_AFTER_SECONDS,
      });
    }

    const value = (setting.value ?? {}) as HeartbeatValue;
    const lastSeenAt = value.lastSeenAt ?? null;

    if (!lastSeenAt) {
      return NextResponse.json({
        reachable: false,
        reason: "no-heartbeat",
        lastHeartbeatAt: null,
        ageSeconds: null,
        uptimeSeconds: null,
        lastJobAt: null,
        staleAfterSeconds: STALE_AFTER_SECONDS,
      });
    }

    const lastSeenMs = new Date(lastSeenAt).getTime();
    if (Number.isNaN(lastSeenMs)) {
      return NextResponse.json({
        reachable: false,
        reason: "bad-timestamp",
        lastHeartbeatAt: lastSeenAt,
        ageSeconds: null,
        uptimeSeconds: null,
        lastJobAt: null,
        staleAfterSeconds: STALE_AFTER_SECONDS,
      });
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000));
    const reachable = ageSeconds <= STALE_AFTER_SECONDS;

    // lastJobAt arrives as a Unix epoch (time.time()) from the bridge;
    // surface it as ISO for the hook.
    let lastJobAtIso: string | null = null;
    if (typeof value.lastJobAt === "number" && Number.isFinite(value.lastJobAt)) {
      const ms = value.lastJobAt * 1000;
      if (!Number.isNaN(ms)) lastJobAtIso = new Date(ms).toISOString();
    }

    return NextResponse.json({
      reachable,
      lastHeartbeatAt: lastSeenAt,
      ageSeconds,
      uptimeSeconds:
        typeof value.uptime === "number" && Number.isFinite(value.uptime)
          ? value.uptime
          : null,
      lastJobAt: lastJobAtIso,
      staleAfterSeconds: STALE_AFTER_SECONDS,
    });
  } catch (error) {
    console.error("[GET /api/bridge/status]", error);
    return NextResponse.json(
      {
        reachable: false,
        reason: "error",
        lastHeartbeatAt: null,
        ageSeconds: null,
        uptimeSeconds: null,
        lastJobAt: null,
        staleAfterSeconds: STALE_AFTER_SECONDS,
      },
      { status: 500 }
    );
  }
}
