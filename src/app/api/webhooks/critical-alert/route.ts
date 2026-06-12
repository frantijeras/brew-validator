import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

/**
 * POST /api/webhooks/critical-alert
 *
 * Receptor del webhook de alertas críticas que dispara el backend/bridge
 * (vía CRITICAL_ALERT_WEBHOOK_URL). Persiste una Notification (notificación
 * in-app, dentro de la aplicación) para que el usuario la vea en la campanita.
 *
 * - Protegido con verifyBridgeSecret (mismo patrón que el resto de webhooks).
 * - Best-effort e idempotente: si llega un duplicado (mismo userId + title +
 *   body + errorType sin leer), no crea una segunda fila.
 * - Resolución de destinatario: si el payload trae userId, se usa; si no,
 *   se resuelve desde projectId → project.idea.userId.
 */

// Aceptamos DOS formas de payload de forma tolerante:
//  - Forma "in-app" directa: { title, body, ... } (un backend externo nuestro).
//  - Forma del PRODUCTOR `dispatchCriticalAlert` (lib/critical-alert.ts), que
//    envía { type, label, recommendation, rawMessage, agentName, model,
//    retryCount, projectId, phaseId, errorType }. En ese caso derivamos
//    title/body de label + recommendation/rawMessage (ver más abajo). Así el
//    endpoint nunca da 400 si se conecta al webhook interno del producto.
const payloadSchema = z.object({
  userId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  phaseId: z.string().min(1).optional(),
  level: z.enum(["error", "warning", "info"]).default("error"),
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(4000).optional(),
  errorType: z.string().max(120).optional(),
  actionUrl: z.string().max(2000).optional(),
  // Campos de la forma del productor (dispatchCriticalAlert):
  label: z.string().max(300).optional(),
  recommendation: z.string().max(4000).optional().nullable(),
  rawMessage: z.string().max(4000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON inválido" },
        { status: 400 }
      );
    }

    const data = payloadSchema.parse(raw);

    // Derivar title/body si vino la forma del productor (label/recommendation).
    const title = data.title ?? (data.label ? `Fallo crítico: ${data.label}` : null);
    const body =
      data.body ??
      data.recommendation ??
      data.rawMessage ??
      (data.label ? `Se ha producido un fallo crítico (${data.label}).` : null);

    // Sin contenido mínimo no podemos crear la notificación. Best-effort:
    // 200 para que el emisor no reintente en bucle.
    if (!title || !body) {
      return NextResponse.json({ success: true, skipped: "sin-contenido" });
    }

    // Resolver el destinatario. Preferimos userId explícito; si no llega,
    // lo derivamos del proyecto (project.idea.userId), igual que critical-alert.ts.
    let userId = data.userId ?? null;
    if (!userId && data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { idea: { select: { userId: true } } },
      });
      userId = project?.idea.userId ?? null;
    }

    // Sin destinatario no podemos persistir la notificación. Best-effort:
    // devolvemos 200 para que el emisor no reintente en bucle.
    if (!userId) {
      return NextResponse.json({ success: true, skipped: "sin-destinatario" });
    }

    // Idempotencia: evita duplicar la misma alerta no leída si el webhook
    // se reintenta. No es un unique a nivel DB porque el payload no trae un
    // id estable; usamos una huella por contenido reciente.
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        title,
        body,
        errorType: data.errorType ?? null,
        read: false,
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        skipped: "duplicado",
        id: existing.id,
      });
    }

    const created = await prisma.notification.create({
      data: {
        userId,
        projectId: data.projectId ?? null,
        phaseId: data.phaseId ?? null,
        level: data.level,
        title,
        body,
        errorType: data.errorType ?? null,
        actionUrl: data.actionUrl ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Payload inválido", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[POST /api/webhooks/critical-alert]", error);
    return NextResponse.json(
      { error: "Error al procesar la alerta crítica" },
      { status: 500 }
    );
  }
}
