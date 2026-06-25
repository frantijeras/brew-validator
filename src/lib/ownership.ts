import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

type Guard = { ok: true; userId: string | null } | { ok: false; response: Response };

const notFound = () =>
  NextResponse.json({ error: "No encontrado" }, { status: 404 });

/**
 * Multi-tenant ownership checks.
 *
 * Each Idea has an owner (`Idea.userId`); a Project is owned transitively via
 * its Idea. These helpers verify that the authenticated user owns a resource
 * before a route reads or mutates it.
 *
 * NULL-TOLERANT TRANSITION: legacy rows created before the userId migration
 * have `userId = null`. The DB migration backfills them to the admin user, but
 * to stay safe if any null slips through (or before the backfill runs), we also
 * accept `userId: null` rows. Once every row is backfilled this is effectively
 * strict per-user isolation.
 */

/** Where-fragment matching ideas owned by `userId` (or legacy null-owner rows). */
export function ideaOwnerWhere(userId: string) {
  return { OR: [{ userId }, { userId: null }] };
}

/** True if `userId` may access the idea `ideaId`. */
export async function assertOwnsIdea(
  ideaId: string,
  userId: string
): Promise<boolean> {
  const idea = await prisma.idea.findFirst({
    where: { id: ideaId, ...ideaOwnerWhere(userId) },
    select: { id: true },
  });
  return idea !== null;
}

/** True if `userId` may access the project `projectId` (owner = project.idea.userId). */
export async function assertOwnsProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, idea: ideaOwnerWhere(userId) },
    select: { id: true },
  });
  return project !== null;
}

/**
 * Route guard for idea endpoints used by the BROWSER ONLY (mutations + owner
 * reads). Requires a session and verifies ownership; 401 / 404 otherwise.
 */
export async function guardIdea(ideaId: string): Promise<Guard> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!(await assertOwnsIdea(ideaId, auth.userId))) {
    return { ok: false, response: notFound() };
  }
  return { ok: true, userId: auth.userId };
}

/**
 * Route guard for idea READ endpoints the bridge also calls for context.
 * Allows a valid bridge secret (no session); otherwise falls back to the
 * owner-only guard. While BRIDGE_SECRET is unset, verifyBridgeSecret is
 * fail-open (matches the middleware) — same transition behaviour as before.
 */
export async function guardIdeaOrBridge(req: Request, ideaId: string): Promise<Guard> {
  if (verifyBridgeSecret(req)) return { ok: true, userId: null };
  return guardIdea(ideaId);
}

/** Route guard for project endpoints (owner via project.idea.userId). */
export async function guardProject(projectId: string): Promise<Guard> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!(await assertOwnsProject(projectId, auth.userId))) {
    return { ok: false, response: notFound() };
  }
  return { ok: true, userId: auth.userId };
}

/**
 * Route guard for endpoints that reference a phase by id (owner via
 * phase.project.idea.userId). Used by routes that receive only a phaseId.
 */
export async function guardPhase(phaseId: string): Promise<Guard> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const phase = await prisma.projectPhase.findFirst({
    where: { id: phaseId, project: { idea: ideaOwnerWhere(auth.userId) } },
    select: { id: true },
  });
  if (!phase) return { ok: false, response: notFound() };
  return { ok: true, userId: auth.userId };
}

/**
 * Route guard for JOB endpoints (owner via job.idea.userId). The bridge also
 * hits these (read status, mark RUNNING/FAILED) so a valid bridge secret is
 * allowed without a session; otherwise we require the authenticated owner.
 */
export async function guardJobOrBridge(req: Request, jobId: string): Promise<Guard> {
  if (verifyBridgeSecret(req)) return { ok: true, userId: null };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const job = await prisma.job.findFirst({
    where: { id: jobId, idea: ideaOwnerWhere(auth.userId) },
    select: { id: true },
  });
  if (!job) return { ok: false, response: notFound() };
  return { ok: true, userId: auth.userId };
}
