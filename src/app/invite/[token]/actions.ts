"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function acceptInvitation(token: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

  if (!name || !password || !confirmPassword) {
    return { error: "Todos los campos son obligatorios" };
  }

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }

  // Re-validar la invitación en el momento de enviar (puede haber caducado o
  // haberse revocado/aceptado entre la carga de la página y el submit).
  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt < new Date()
  ) {
    return { error: "Invitación inválida o caducada" };
  }

  const email = invitation.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con este email" };
  }

  const hashed = await bcrypt.hash(password, 12);
  const now = new Date();

  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      invitedById: invitation.invitedById,
      invitedAt: now,
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: now,
      acceptedUserId: newUser.id,
    },
  });

  redirect("/login?invited=1");
}
