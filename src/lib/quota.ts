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

// ── Consumo ATÓMICO de cuota (gate + incremento en una sola operación) ──
//
// PROBLEMA (TOCTOU): hacer `assertCan*` (lectura) y luego `increment*`
// (escritura) por separado deja una ventana en la que dos peticiones
// concurrentes pasan ambas la comprobación y exceden la cuota vitalicia en +1.
//
// SOLUCIÓN: una única `updateMany` condicional `{ where: { <counter>: { lt:
// <max> } }, data: { <counter>: { increment: 1 } } }`. La condición y el
// incremento son atómicos a nivel de fila en la base de datos, así que solo una
// de las peticiones concurrentes consigue `count === 1`; el resto recibe
// `count === 0` (cuota agotada). Los admins están EXENTOS (no se incrementa).
//
// Si la creación posterior falla, usa el `refund*` correspondiente para
// deshacer el consumo (decremento con suelo en 0).

/**
 * Consume 1 de la cuota vitalicia de ideas de forma atómica. Admin → exento.
 * Devuelve `{ ok: false, error }` si la cuota está agotada (sin incrementar).
 */
export async function consumeIdeaQuota(userId: string): Promise<QuotaCheck> {
  const { isAdmin, maxIdeas } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isAdmin: true, maxIdeas: true },
  });
  if (isAdmin) return { ok: true };
  const { count } = await prisma.user.updateMany({
    where: { id: userId, ideasCreated: { lt: maxIdeas } },
    data: { ideasCreated: { increment: 1 } },
  });
  if (count === 1) return { ok: true };
  return {
    ok: false,
    error: `Has alcanzado el máximo de ${maxIdeas} ideas de tu plan.`,
  };
}

/**
 * Consume 1 de la cuota vitalicia de proyectos de forma atómica. Admin → exento.
 * Devuelve `{ ok: false, error }` si la cuota está agotada (sin incrementar).
 */
export async function consumeProjectQuota(userId: string): Promise<QuotaCheck> {
  const { isAdmin, maxProjects } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isAdmin: true, maxProjects: true },
  });
  if (isAdmin) return { ok: true };
  const { count } = await prisma.user.updateMany({
    where: { id: userId, projectsCreated: { lt: maxProjects } },
    data: { projectsCreated: { increment: 1 } },
  });
  if (count === 1) return { ok: true };
  return {
    ok: false,
    error: `Has alcanzado el máximo de ${maxProjects} proyectos de tu plan.`,
  };
}

/**
 * Consume 1 de la cuota vitalicia de refinados de forma atómica. Admin → exento.
 * Devuelve `{ ok: false, error }` si la cuota está agotada (sin incrementar).
 */
export async function consumeRefineQuota(userId: string): Promise<QuotaCheck> {
  const { isAdmin, maxRefines } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isAdmin: true, maxRefines: true },
  });
  if (isAdmin) return { ok: true };
  const { count } = await prisma.user.updateMany({
    where: { id: userId, refinesUsed: { lt: maxRefines } },
    data: { refinesUsed: { increment: 1 } },
  });
  if (count === 1) return { ok: true };
  return {
    ok: false,
    error: "Has alcanzado el máximo de refinados de tu plan.",
  };
}

/** Devuelve 1 a la cuota de ideas (deshacer un consume). No-op en admin. */
export async function refundIdeaQuota(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, isAdmin: false, ideasCreated: { gt: 0 } },
    data: { ideasCreated: { decrement: 1 } },
  });
}

/** Devuelve 1 a la cuota de proyectos (deshacer un consume). No-op en admin. */
export async function refundProjectQuota(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, isAdmin: false, projectsCreated: { gt: 0 } },
    data: { projectsCreated: { decrement: 1 } },
  });
}

/** Devuelve 1 a la cuota de refinados (deshacer un consume). No-op en admin. */
export async function refundRefineQuota(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, isAdmin: false, refinesUsed: { gt: 0 } },
    data: { refinesUsed: { decrement: 1 } },
  });
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
