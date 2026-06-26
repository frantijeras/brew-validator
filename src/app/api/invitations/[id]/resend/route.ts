import { NextResponse } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email";

const EXPIRY_DAYS = 7;

function newToken(): string {
  return `${randomUUID()}${randomBytes(16).toString("hex")}`;
}

/**
 * POST /api/invitations/[id]/resend — Reactiva y reenvía una invitación. Solo
 * admin. Sirve para "volver a intentarlo" cuando una invitación fue REVOCADA
 * (por error del admin o del usuario al rechazarla) o ha CADUCADO: regenera
 * token + caducidad, la deja en PENDING y reenvía el email. No aplica a las ya
 * ACEPTADAS (esas ya tienen cuenta).
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
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  }
  if (inv.status === "ACCEPTED") {
    return NextResponse.json(
      { error: "Esa invitación ya fue aceptada (el usuario ya tiene cuenta)." },
      { status: 400 }
    );
  }

  // Si entretanto se creó una cuenta con ese email, no reenviamos.
  const existingUser = await prisma.user.findUnique({ where: { email: inv.email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Ese email ya tiene cuenta" },
      { status: 400 }
    );
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.invitation.update({
    where: { id },
    data: {
      token,
      expiresAt,
      status: "PENDING",
      acceptedAt: null,
      acceptedUserId: null,
      invitedById: session.user.id,
    },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;
  const { sent, error } = await sendInvitationEmail(updated.email, inviteUrl);

  return NextResponse.json({ ok: true, inviteUrl, emailSent: sent, emailError: error });
}
