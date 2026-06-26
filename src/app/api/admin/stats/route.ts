import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/stats — Embudo de conversión + totales globales. Solo admin.
 *
 * Embudo (funnel) de conversión, paso a paso (cada paso es un subconjunto del
 * anterior y se mide en usuarios DISTINTOS salvo el primer paso):
 *  1. invited            — invitaciones enviadas (todas, sea cual sea su estado).
 *  2. accounts           — cuentas creadas (total de usuarios).
 *  3. withIdea           — usuarios dueños de ≥1 idea.
 *  4. withValidatedIdea  — usuarios dueños de ≥1 idea con validationStatus="DONE".
 *  5. withProject        — usuarios dueños de ≥1 proyecto (vía project.idea.userId).
 *  6. withHandoff        — usuarios dueños de ≥1 proyecto con handoffReady=true.
 *
 * Además:
 *  - invitations: { pending, accepted, revoked } — recuento por estado.
 *  - totalIdeas / totalProjects: totales globales.
 *  - totalCost:   suma global de Job.cost (gasto de IA acumulado).
 *  - costByAgent: gasto de IA por agente/modelo.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [
    invitationGroups,
    invitationsTotal,
    usersTotal,
    totalIdeas,
    totalProjects,
    costAgg,
    distinctIdeaOwners,
    distinctValidatedOwners,
    ideasWithProject,
    ideasWithHandoff,
    costByAgentGroups,
  ] = await Promise.all([
    prisma.invitation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.invitation.count(),
    prisma.user.count(),
    prisma.idea.count(),
    prisma.project.count(),
    prisma.job.aggregate({ _sum: { cost: true } }),
    // Dueños distintos de ≥1 idea.
    prisma.idea.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    // Dueños distintos de ≥1 idea VALIDADA (validationStatus="DONE").
    prisma.idea.findMany({
      where: { userId: { not: null }, validationStatus: "DONE" },
      distinct: ["userId"],
      select: { userId: true },
    }),
    // Ideas con proyecto (para contar dueños distintos con proyecto).
    prisma.idea.findMany({
      where: { userId: { not: null }, project: { isNot: null } },
      select: { userId: true },
    }),
    // Ideas cuyo proyecto tiene el hand-off exportado (handoffReady=true).
    prisma.idea.findMany({
      where: { userId: { not: null }, project: { is: { handoffReady: true } } },
      select: { userId: true },
    }),
    prisma.job.groupBy({
      by: ["agentName"],
      _sum: { cost: true },
      _count: { _all: true },
    }),
  ]);

  // Gasto de IA por agente/modelo (agentName), de mayor a menor coste.
  const costByAgent = costByAgentGroups
    .map((g) => ({
      agent: g.agentName,
      cost: g._sum.cost ?? 0,
      jobs: g._count._all,
    }))
    .sort((a, b) => b.cost - a.cost);

  const invCount = (status: string) =>
    invitationGroups.find((g) => g.status === status)?._count._all ?? 0;

  const projectOwners = new Set(ideasWithProject.map((i) => i.userId));
  const handoffOwners = new Set(ideasWithHandoff.map((i) => i.userId));

  const usersWithIdea = distinctIdeaOwners.length;
  const usersWithValidatedIdea = distinctValidatedOwners.length;
  const usersWithProject = projectOwners.size;
  const usersWithHandoff = handoffOwners.size;

  return NextResponse.json({
    invitations: {
      pending: invCount("PENDING"),
      accepted: invCount("ACCEPTED"),
      revoked: invCount("REVOKED"),
    },
    users: usersTotal,
    usersWithIdea,
    usersWithValidatedIdea,
    usersWithProject,
    usersWithHandoff,
    totalIdeas,
    totalProjects,
    totalCost: costAgg._sum.cost ?? 0,
    costByAgent,
    // Embudo de conversión: pasos ordenados (cada paso ⊆ anterior).
    funnel: [
      { key: "invited", label: "Invitados", value: invitationsTotal },
      { key: "accounts", label: "Cuentas", value: usersTotal },
      { key: "withIdea", label: "Con idea", value: usersWithIdea },
      { key: "withValidatedIdea", label: "Idea validada", value: usersWithValidatedIdea },
      { key: "withProject", label: "Con proyecto", value: usersWithProject },
      { key: "withHandoff", label: "Hand-off exportado", value: usersWithHandoff },
    ],
  });
}
