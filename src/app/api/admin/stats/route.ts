import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/stats — Embudo de invitaciones + totales globales. Solo admin.
 *
 * Embudo (funnel): de invitaciones enviadas a usuarios activos con uso real.
 *  - invitations: { pending, accepted, revoked } — recuento por estado.
 *  - users:           total de cuentas existentes.
 *  - usersWithIdea:   nº de usuarios DISTINTOS dueños de al menos una idea.
 *  - usersWithProject:nº de usuarios DISTINTOS dueños de al menos un proyecto
 *                     (vía project.idea.userId).
 *  - totalIdeas / totalProjects: totales globales.
 *  - totalCost:       suma global de Job.cost (gasto de IA acumulado).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [
    invitationGroups,
    usersTotal,
    totalIdeas,
    totalProjects,
    costAgg,
    distinctIdeaOwners,
  ] = await Promise.all([
    prisma.invitation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
    prisma.idea.count(),
    prisma.project.count(),
    prisma.job.aggregate({ _sum: { cost: true } }),
    prisma.idea.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  const invCount = (status: string) =>
    invitationGroups.find((g) => g.status === status)?._count._all ?? 0;

  // usersWithProject: dueños distintos de ideas que tienen proyecto.
  const ideasWithProject = await prisma.idea.findMany({
    where: { userId: { not: null }, project: { isNot: null } },
    select: { userId: true },
  });
  const projectOwners = new Set(ideasWithProject.map((i) => i.userId));

  return NextResponse.json({
    invitations: {
      pending: invCount("PENDING"),
      accepted: invCount("ACCEPTED"),
      revoked: invCount("REVOKED"),
    },
    users: usersTotal,
    usersWithIdea: distinctIdeaOwners.length,
    usersWithProject: projectOwners.size,
    totalIdeas,
    totalProjects,
    totalCost: costAgg._sum.cost ?? 0,
  });
}
