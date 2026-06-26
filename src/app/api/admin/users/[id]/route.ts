import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateUserSchema = z
  .object({
    maxIdeas: z.number().int().min(0).optional(),
    maxProjects: z.number().int().min(0).optional(),
    maxRefines: z.number().int().min(0).optional(),
    phaseUndosAllowed: z.number().int().min(0).optional(),
    canAccessSkills: z.boolean().optional(),
    canAccessHandoff: z.boolean().optional(),
    status: z.enum(["active", "suspended"]).optional(),
    isAdmin: z.boolean().optional(),
    plan: z.enum(["gratis", "estandar", "premium"]).optional(),
    resetUsage: z.boolean().optional(),
  })
  .strict();

/**
 * PATCH /api/admin/users/[id] — El admin edita límites/flags/estado/rol de
 * cualquier usuario. Solo admin (403 en caso contrario).
 *
 * Anti-bloqueo: un admin NO puede quitarse a sí mismo el rol admin ni
 * suspenderse a sí mismo (evita dejar el sistema sin acceso de administración).
 */
export async function PATCH(
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

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos no válidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const data = parsed.data;
  const isSelf = id === session.user.id;

  // Anti auto-bloqueo: el admin no puede degradarse ni suspenderse a sí mismo.
  if (isSelf && data.isAdmin === false) {
    return NextResponse.json(
      { error: "No puedes quitarte a ti mismo el rol de administrador" },
      { status: 400 }
    );
  }
  if (isSelf && data.status === "suspended") {
    return NextResponse.json(
      { error: "No puedes suspender tu propia cuenta" },
      { status: 400 }
    );
  }

  // `resetUsage` no es una columna: se traduce a poner a 0 el uso de por vida
  // del usuario y resetear los rollbacks de sus proyectos. El resto de campos
  // (plan incluido) se aplican directamente.
  const { resetUsage, ...userData } = data;

  const updated = await prisma.$transaction(async (tx) => {
    if (resetUsage) {
      await tx.project.updateMany({
        where: { idea: { userId: id } },
        data: { rollbacksUsed: 0 },
      });
    }

    return tx.user.update({
      where: { id },
      data: {
        ...userData,
        ...(resetUsage
          ? { ideasCreated: 0, projectsCreated: 0, refinesUsed: 0 }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        status: true,
        createdAt: true,
        invitedAt: true,
        maxIdeas: true,
        maxProjects: true,
        maxRefines: true,
        phaseUndosAllowed: true,
        canAccessSkills: true,
        canAccessHandoff: true,
        plan: true,
        ideasCreated: true,
        projectsCreated: true,
        refinesUsed: true,
      },
    });
  });

  return NextResponse.json({ user: updated });
}
