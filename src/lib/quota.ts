import { prisma } from "@/lib/db";
import { ideaOwnerWhere } from "@/lib/ownership";

/**
 * Cuotas y feature gates por usuario (multi-tenant).
 *
 * REGLA DE ORO: los administradores (`isAdmin`) están EXENTOS de TODAS las
 * cuotas y gates: acceso ilimitado y completo. El resto de usuarios se rigen
 * por los límites/flags de su fila en `User`.
 *
 * Estas comprobaciones son la fuente de verdad en el SERVIDOR. La UI las
 * refleja, pero la aplicación efectiva ocurre aquí (cada ruta protegida llama a
 * los `assertCan*` y devuelve 403 con el mensaje cuando se bloquea).
 */

export interface UserAccess {
  isAdmin: boolean;
  plan: string;
  maxIdeas: number;
  maxProjects: number;
  maxRefines: number;
  ideasCreated: number;
  projectsCreated: number;
  refinesUsed: number;
  phaseUndosAllowed: number;
  canAccessSkills: boolean;
  canAccessHandoff: boolean;
}

export type QuotaCheck = { ok: true } | { ok: false; error: string };

/** Lee los límites/flags del usuario. Lanza si el usuario no existe. */
export async function getUserAccess(userId: string): Promise<UserAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isAdmin: true,
      plan: true,
      maxIdeas: true,
      maxProjects: true,
      maxRefines: true,
      ideasCreated: true,
      projectsCreated: true,
      refinesUsed: true,
      phaseUndosAllowed: true,
      canAccessSkills: true,
      canAccessHandoff: true,
    },
  });
  if (!user) {
    throw new Error(`Usuario no encontrado: ${userId}`);
  }
  return user;
}

/** Número de ideas que posee el usuario (incluye filas legacy null-owner). */
export function countIdeas(userId: string): Promise<number> {
  return prisma.idea.count({ where: ideaOwnerWhere(userId) });
}

/** Número de proyectos del usuario (ownership transitivo vía idea). */
export function countProjects(userId: string): Promise<number> {
  return prisma.project.count({ where: { idea: ideaOwnerWhere(userId) } });
}

/**
 * ¿Puede el usuario crear una idea más? Admin → siempre.
 *
 * Cuota VITALICIA: se compara el contador acumulado `ideasCreated` (que nunca
 * se decrementa al borrar) con `maxIdeas`, NO el número de ideas vivas. Así,
 * borrar ideas no "libera" cuota del plan.
 */
export async function assertCanCreateIdea(userId: string): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin) return { ok: true };
  if (access.ideasCreated >= access.maxIdeas) {
    return {
      ok: false,
      error: `Has alcanzado el máximo de ${access.maxIdeas} ideas de tu plan.`,
    };
  }
  return { ok: true };
}

/**
 * ¿Puede el usuario crear un proyecto más? Admin → siempre.
 * Cuota VITALICIA: compara `projectsCreated` acumulado con `maxProjects`.
 */
export async function assertCanCreateProject(
  userId: string
): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin) return { ok: true };
  if (access.projectsCreated >= access.maxProjects) {
    return {
      ok: false,
      error: `Has alcanzado el máximo de ${access.maxProjects} proyectos de tu plan.`,
    };
  }
  return { ok: true };
}

/**
 * ¿Puede el usuario refinar una idea más? Admin → siempre.
 * Cuota VITALICIA: compara `refinesUsed` acumulado con `maxRefines`.
 */
export async function assertCanRefine(userId: string): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin) return { ok: true };
  if (access.refinesUsed >= access.maxRefines) {
    return {
      ok: false,
      error: "Has alcanzado el máximo de refinados de tu plan.",
    };
  }
  return { ok: true };
}

/** Incrementa el contador vitalicio de refinados usados (+1). */
export async function incrementRefinesUsed(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refinesUsed: { increment: 1 } },
  });
}

/** Incrementa el contador vitalicio de ideas creadas (+1). */
export async function incrementIdeasCreated(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { ideasCreated: { increment: 1 } },
  });
}

/** Incrementa el contador vitalicio de proyectos creados (+1). */
export async function incrementProjectsCreated(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { projectsCreated: { increment: 1 } },
  });
}

/** Gate de Skills: admin o flag activo → ok. */
export async function assertCanAccessSkills(
  userId: string
): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin || access.canAccessSkills) return { ok: true };
  return {
    ok: false,
    error: "Función no disponible en tu cuenta. Pídela al administrador.",
  };
}

/** Gate de Hand-off: admin o flag activo → ok. */
export async function assertCanAccessHandoff(
  userId: string
): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin || access.canAccessHandoff) return { ok: true };
  return {
    ok: false,
    error: "Función no disponible en tu cuenta. Pídela al administrador.",
  };
}
