import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/users — Lista TODOS los usuarios con sus límites/flags/estado
 * y métricas de uso agregadas. Solo admin (403 en caso contrario).
 *
 * USAGE por usuario:
 *  - ideasCount:    nº de ideas que posee (Idea.userId)
 *  - projectsCount: nº de proyectos a través de sus ideas (project.idea.userId)
 *  - totalCost:     suma de Job.cost de los jobs de sus ideas
 *  - lastActivity:  el más reciente entre el último Job.createdAt y la última
 *                   Idea.updatedAt del usuario
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 1) Todos los usuarios con sus campos editables.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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

  // 2) Ideas por usuario (count + última actividad de idea) en una pasada.
  const ideas = await prisma.idea.findMany({
    where: { userId: { not: null } },
    select: { id: true, userId: true, updatedAt: true },
  });

  const ideasByUser = new Map<
    string,
    { ideaIds: string[]; lastIdeaUpdate: Date | null }
  >();
  const ideaToUser = new Map<string, string>();
  for (const idea of ideas) {
    const uid = idea.userId!;
    ideaToUser.set(idea.id, uid);
    const entry = ideasByUser.get(uid) ?? { ideaIds: [], lastIdeaUpdate: null };
    entry.ideaIds.push(idea.id);
    if (!entry.lastIdeaUpdate || idea.updatedAt > entry.lastIdeaUpdate) {
      entry.lastIdeaUpdate = idea.updatedAt;
    }
    ideasByUser.set(uid, entry);
  }

  // 3) Proyectos por idea (un proyecto pertenece a una idea -> a un usuario).
  const projects = await prisma.project.findMany({
    select: { ideaId: true },
  });
  const projectsByUser = new Map<string, number>();
  for (const p of projects) {
    const uid = ideaToUser.get(p.ideaId);
    if (!uid) continue;
    projectsByUser.set(uid, (projectsByUser.get(uid) ?? 0) + 1);
  }

  // 4) Coste agregado por idea (groupBy) y última actividad de jobs por idea.
  const costByIdea = await prisma.job.groupBy({
    by: ["ideaId"],
    _sum: { cost: true },
    _max: { createdAt: true },
  });
  const costByUser = new Map<string, number>();
  const lastJobByUser = new Map<string, Date>();
  for (const row of costByIdea) {
    const uid = ideaToUser.get(row.ideaId);
    if (!uid) continue;
    costByUser.set(uid, (costByUser.get(uid) ?? 0) + (row._sum.cost ?? 0));
    const last = row._max.createdAt;
    if (last) {
      const prev = lastJobByUser.get(uid);
      if (!prev || last > prev) lastJobByUser.set(uid, last);
    }
  }

  const result = users.map((u) => {
    const ideaEntry = ideasByUser.get(u.id);
    const lastIdea = ideaEntry?.lastIdeaUpdate ?? null;
    const lastJob = lastJobByUser.get(u.id) ?? null;
    let lastActivity: Date | null = null;
    if (lastIdea && lastJob) lastActivity = lastIdea > lastJob ? lastIdea : lastJob;
    else lastActivity = lastIdea ?? lastJob;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: u.isAdmin,
      status: u.status,
      createdAt: u.createdAt,
      invitedAt: u.invitedAt,
      maxIdeas: u.maxIdeas,
      maxProjects: u.maxProjects,
      maxRefines: u.maxRefines,
      phaseUndosAllowed: u.phaseUndosAllowed,
      canAccessSkills: u.canAccessSkills,
      canAccessHandoff: u.canAccessHandoff,
      plan: u.plan,
      ideasCreated: u.ideasCreated,
      projectsCreated: u.projectsCreated,
      refinesUsed: u.refinesUsed,
      ideasCount: ideaEntry?.ideaIds.length ?? 0,
      projectsCount: projectsByUser.get(u.id) ?? 0,
      totalCost: costByUser.get(u.id) ?? 0,
      lastActivity,
    };
  });

  return NextResponse.json({ users: result });
}
