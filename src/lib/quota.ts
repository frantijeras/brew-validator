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
  maxIdeas: number;
  maxProjects: number;
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
      maxIdeas: true,
      maxProjects: true,
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

/** ¿Puede el usuario crear una idea más? Admin → siempre. */
export async function assertCanCreateIdea(userId: string): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin) return { ok: true };
  const used = await countIdeas(userId);
  if (used >= access.maxIdeas) {
    return {
      ok: false,
      error: `Has alcanzado el máximo de ${access.maxIdeas} ideas.`,
    };
  }
  return { ok: true };
}

/** ¿Puede el usuario crear un proyecto más? Admin → siempre. */
export async function assertCanCreateProject(
  userId: string
): Promise<QuotaCheck> {
  const access = await getUserAccess(userId);
  if (access.isAdmin) return { ok: true };
  const used = await countProjects(userId);
  if (used >= access.maxProjects) {
    return {
      ok: false,
      error: `Has alcanzado el máximo de ${access.maxProjects} proyectos.`,
    };
  }
  return { ok: true };
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
