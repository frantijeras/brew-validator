/**
 * Alertas críticas del Bridge (Puente con las APIs de IA) — Capa 4 del feedback.
 *
 * Cuando un error es crítico (3+ reintentos fallidos), se notifica al usuario:
 *  1. Se crea una fila `Notification` in-app (la campanita del dashboard la lee).
 *  2. Si hay `CRITICAL_ALERT_WEBHOOK_URL` configurado, se dispara un webhook al
 *     backend para notificación externa (email/in-app). Best-effort.
 *
 * Es BEST-EFFORT: nunca lanza. Una alerta que falla no debe romper el callback.
 * SEGURIDAD: no registra secretos; la URL del webhook viene de variable de
 * entorno y solo se envía el contexto del error.
 */

import { prisma } from "@/lib/db";
import { getErrorMeta, type ErrorCategory } from "@/lib/phase-errors";
import { getUserMessage } from "@/lib/user-messages";

export interface CriticalAlertInput {
  projectId?: string | null;
  phaseId?: string | null;
  agentName?: string | null;
  errorType: ErrorCategory;
  /** Mensaje crudo (para el webhook/debug; NO se muestra tal cual al usuario). */
  rawMessage?: string | null;
  retryCount?: number | null;
  model?: string | null;
}

/**
 * Resuelve el `userId` dueño de un proyecto (Project → Idea → userId).
 * Devuelve null si no se puede determinar (proyecto sin usuario / inexistente).
 */
async function resolveProjectOwner(projectId: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { idea: { select: { userId: true } } },
    });
    return project?.idea.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Dispara la alerta crítica. Crea la notificación in-app y, opcionalmente,
 * llama al webhook externo. Devuelve true si se creó al menos la notificación.
 */
export async function dispatchCriticalAlert(
  input: CriticalAlertInput
): Promise<boolean> {
  const meta = getErrorMeta(input.errorType);
  const userMsg = getUserMessage(input.errorType);

  let created = false;

  // 1) Notificación in-app (requiere userId → lo resolvemos del proyecto).
  if (input.projectId) {
    const userId = await resolveProjectOwner(input.projectId);
    if (userId) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            projectId: input.projectId,
            phaseId: input.phaseId ?? null,
            level: "error",
            title: `Fallo crítico: ${meta.label}`,
            body: `${userMsg.text}${meta.hint ? ` (${meta.hint})` : ""}`,
            errorType: input.errorType,
            actionUrl: input.projectId
              ? `/proyectos/${input.projectId}`
              : null,
          },
        });
        created = true;
      } catch (e) {
        console.error("[dispatchCriticalAlert] no se pudo crear la notificación", e);
      }
    }
  }

  // 2) Webhook externo opcional (email/in-app backend). Best-effort.
  const webhookUrl = process.env.CRITICAL_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          type: "bridge_critical_error",
          errorType: input.errorType,
          label: meta.label,
          recommendation: meta.hint ?? null,
          projectId: input.projectId ?? null,
          phaseId: input.phaseId ?? null,
          agentName: input.agentName ?? null,
          model: input.model ?? null,
          retryCount: input.retryCount ?? null,
          // mensaje crudo recortado para debug interno
          rawMessage: input.rawMessage ? String(input.rawMessage).slice(0, 1000) : null,
        }),
      });
      clearTimeout(timeout);
    } catch (e) {
      console.error("[dispatchCriticalAlert] webhook externo falló", e);
    }
  }

  return created;
}
