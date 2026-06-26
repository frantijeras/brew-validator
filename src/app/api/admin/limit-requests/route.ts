import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/limit-requests — Lista TODAS las solicitudes de ampliación de
 * límites/acceso, más recientes primero, con datos del usuario solicitante.
 * Solo admin (403 en caso contrario).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const rows = await prisma.limitRequest.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      message: true,
      createdAt: true,
      resolvedAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ requests: rows });
}
