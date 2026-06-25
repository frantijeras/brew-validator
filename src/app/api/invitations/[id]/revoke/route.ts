import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/invitations/[id]/revoke — Revoca una invitación PENDING. Solo admin.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation) {
    return NextResponse.json(
      { error: "Invitación no encontrada" },
      { status: 404 }
    );
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Solo se pueden revocar invitaciones pendientes" },
      { status: 400 }
    );
  }

  const updated = await prisma.invitation.update({
    where: { id },
    data: { status: "REVOKED" },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });

  return NextResponse.json({ invitation: updated });
}
