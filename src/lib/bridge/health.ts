import { prisma } from "@/lib/db";

/**
 * Salud del bridge (daemon externo). Lee el heartbeat que el bridge postea a
 * `bridge_heartbeat` (Setting). Reutiliza la MISMA regla que
 * `/api/bridge/status`: "vivo" = último heartbeat hace < 60s.
 *
 * Se usa para FAIL-FAST: antes de encolar un job (validar idea, ejecutar fase,
 * mejorar skill) comprobamos que el bridge está vivo. Si no lo está, devolvemos
 * un error inmediato al usuario en vez de dejar el proceso colgado esperando un
 * callback que nunca llegará.
 */

const HEARTBEAT_KEY = "bridge_heartbeat";
const STALE_AFTER_SECONDS = 60;

export interface BridgeHealth {
  reachable: boolean;
  reason?: string;
  ageSeconds: number | null;
}

export async function getBridgeHealth(): Promise<BridgeHealth> {
  try {
    const setting = await prisma.setting.findFirst({ where: { key: HEARTBEAT_KEY } });
    if (!setting) return { reachable: false, reason: "no-heartbeat", ageSeconds: null };

    const value = (setting.value ?? {}) as { lastSeenAt?: string };
    const lastSeenAt = value.lastSeenAt ?? null;
    if (!lastSeenAt) return { reachable: false, reason: "no-heartbeat", ageSeconds: null };

    const lastSeenMs = new Date(lastSeenAt).getTime();
    if (Number.isNaN(lastSeenMs)) {
      return { reachable: false, reason: "bad-timestamp", ageSeconds: null };
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000));
    const reachable = ageSeconds <= STALE_AFTER_SECONDS;
    return { reachable, reason: reachable ? undefined : "stale", ageSeconds };
  } catch {
    return { reachable: false, reason: "error", ageSeconds: null };
  }
}

/** Mensaje legible para el usuario cuando el bridge no está disponible. */
export const BRIDGE_OFFLINE_MESSAGE =
  "El motor de IA (bridge) no está disponible ahora mismo. Inténtalo de nuevo en unos minutos; si persiste, revisa que el bridge esté en marcha.";
