"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "No autorizado" };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const image = (formData.get("image") as string)?.trim() || null;

  if (!name || !email) {
    return { error: "Nombre y email son obligatorios" };
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== session.user.id) {
    return { error: "Este email ya está en uso" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email, image },
  });

  revalidatePath("/settings");
  return { success: "Perfil actualizado correctamente" };
}

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "No autorizado" };
  }

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Todos los campos son obligatorios" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }

  if (newPassword.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return { error: "Usuario no encontrado" };
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return { error: "La contraseña actual es incorrecta" };
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  });

  revalidatePath("/settings");
  return { success: "Contraseña cambiada correctamente" };
}

export async function saveAgentModels(config: Record<string, string>) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "No autorizado" };
  }

  try {
    const configPath = path.resolve(
      process.env.HOME || "/root",
      ".openclaw/workspace/skills/bridge-daemon/agent-models.json"
    );
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    console.error("[saveAgentModels]", err);
    return { error: "Error al guardar la configuración de modelos" };
  }
}

export async function addUser(formData: FormData) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return { error: "Solo el administrador puede añadir usuarios" };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const tempPassword = formData.get("tempPassword") as string;

  if (!name || !email || !tempPassword) {
    return { error: "Todos los campos son obligatorios" };
  }

  if (tempPassword.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Este email ya está registrado" };
  }

  const hashed = await bcrypt.hash(tempPassword, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      isAdmin: false,
    },
  });

  revalidatePath("/settings");
  return { success: "Usuario añadido correctamente" };
}
