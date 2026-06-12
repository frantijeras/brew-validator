import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

/**
 * GET /api/notifications
 *
 * Devuelve las notificaciones in-app (dentro de la aplicación) del usuario
 * autenticado: las 30 más recientes y el contador de no leídas (unread).
 * Aislamiento multi-tenant: solo se leen filas con userId === sesión.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json(
      { error: "Error al cargar las notificaciones" },
      { status: 500 }
    );
  }
}

// Cuerpo aceptado: marcar una notificación ({ id }) o todas ({ markAll: true }).
const markReadSchema = z
  .object({
    id: z.string().min(1).optional(),
    markAll: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.id) || data.markAll === true, {
    message: 'Debes indicar "id" o "markAll: true"',
  });

/**
 * Marca notificaciones como leídas (read). El where siempre incluye
 * userId === sesión, de modo que un usuario no puede tocar notificaciones
 * de otro (sin fuga entre usuarios). updateMany devuelve count para informar.
 */
async function markAsRead(req: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;
  const { userId } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 }
    );
  }

  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { id, markAll } = parsed.data;
    const result = await prisma.notification.updateMany({
      where: markAll
        ? { userId, read: false }
        : { userId, id },
      data: { read: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return NextResponse.json({ updated: result.count, unreadCount });
  } catch (error) {
    console.error("[PATCH /api/notifications]", error);
    return NextResponse.json(
      { error: "Error al actualizar las notificaciones" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return markAsRead(req);
}

// Algunos clientes (fetch con keepalive en navegadores antiguos) prefieren POST.
export async function POST(req: NextRequest) {
  return markAsRead(req);
}
