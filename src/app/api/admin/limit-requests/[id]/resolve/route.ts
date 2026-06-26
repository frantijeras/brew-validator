import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const resolveSchema = z
  .object({
    action: z.enum(["grant", "dismiss"]),
  })
  .strict();

/**
 * POST /api/admin/limit-requests/[id]/resolve — El admin concede ("grant") o
 * descarta ("dismiss") una solicitud PENDING. Solo admin (403 en caso contrario).
 *
 * Al CONCEDER, se aplica el efecto al usuario solicitante según el tipo:
 *  - "skills"     → canAccessSkills = true
 *  - "handoff"    → canAccessHandoff = true
 *  - "ideas"      → ideasCreated = 0 (recupera la cuota de su plan)
 *  - "projects"   → projectsCreated = 0
 *  - "phase_undo" → phaseUndosAllowed += 1 y rollbacksUsed = 0 en sus proyectos
 *
 * Al DESCARTAR no se toca al usuario. En ambos casos se marca la solicitud como
 * resuelta (status, resolvedAt, resolvedById).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos no válidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action } = parsed.data;

  const request = await prisma.limitRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "La solicitud ya está resuelta" },
      { status: 400 }
    );
  }

  const grant = action === "grant";

  await prisma.$transaction(async (tx) => {
    if (grant) {
      const userId = request.userId;
      switch (request.type) {
        case "skills":
          await tx.user.update({
            where: { id: userId },
            data: { canAccessSkills: true },
          });
          break;
        case "handoff":
          await tx.user.update({
            where: { id: userId },
            data: { canAccessHandoff: true },
          });
          break;
        case "ideas":
          await tx.user.update({
            where: { id: userId },
            data: { ideasCreated: 0 },
          });
          break;
        case "projects":
          await tx.user.update({
            where: { id: userId },
            data: { projectsCreated: 0 },
          });
          break;
        case "phase_undo":
          await tx.user.update({
            where: { id: userId },
            data: { phaseUndosAllowed: { increment: 1 } },
          });
          // Resetea los rollbacks usados en los proyectos del usuario
          // (proyecto -> idea -> userId).
          await tx.project.updateMany({
            where: { idea: { userId } },
            data: { rollbacksUsed: 0 },
          });
          break;
      }
    }

    await tx.limitRequest.update({
      where: { id },
      data: {
        status: grant ? "GRANTED" : "DISMISSED",
        resolvedAt: new Date(),
        resolvedById: session.user!.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
