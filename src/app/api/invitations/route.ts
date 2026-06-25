import { NextResponse } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_DAYS = 7;

function newToken(): string {
  return `${randomUUID()}${randomBytes(16).toString("hex")}`;
}

function expiryDate(): Date {
  return new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * POST /api/invitations — Crea (o reenvía) una invitación. Solo admin.
 * Body: { email }
 * Devuelve siempre `inviteUrl` aunque falle el email, para que el admin
 * pueda copiarlo manualmente.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email no válido" }, { status: 400 });
  }

  // Ya existe una cuenta con ese email.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "Ese email ya tiene cuenta" },
      { status: 400 }
    );
  }

  const token = newToken();
  const expiresAt = expiryDate();

  // Si hay una invitación PENDING, regeneramos su token/caducidad (reenvío)
  // en lugar de duplicar.
  const pending = await prisma.invitation.findFirst({
    where: { email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  let invitation;
  if (pending) {
    invitation = await prisma.invitation.update({
      where: { id: pending.id },
      data: { token, expiresAt, invitedById: session.user.id },
    });
  } else {
    invitation = await prisma.invitation.create({
      data: {
        email,
        token,
        status: "PENDING",
        expiresAt,
        invitedById: session.user.id,
      },
    });
  }

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`;
  const { sent, error } = await sendInvitationEmail(email, inviteUrl);

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
    },
    inviteUrl,
    emailSent: sent,
    emailError: error,
  });
}

/**
 * GET /api/invitations — Lista todas las invitaciones (más recientes primero).
 * Solo admin.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const rows = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      token: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });

  const base = process.env.NEXTAUTH_URL;
  const invitations = rows.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    acceptedAt: r.acceptedAt,
    // El enlace solo es útil mientras la invitación sigue PENDING.
    inviteUrl: r.status === "PENDING" ? `${base}/invite/${r.token}` : null,
  }));

  return NextResponse.json({ invitations });
}
