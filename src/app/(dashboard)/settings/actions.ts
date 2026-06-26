"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

const BRIDGE_URL = process.env.BRIDGE_API_URL ?? "http://127.0.0.1:9090";

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

export async function saveAgentModels(
  config: Record<string, string>,
  thinking?: Record<string, string>,
  plan?: "gratis" | "estandar" | "premium"
) {
  const session = await auth();
  // Solo el admin puede cambiar la configuración de modelos/razonamiento
  // (es config del sistema, no por usuario).
  if (!session?.user?.isAdmin) {
    return { error: "Solo el administrador puede cambiar los modelos" };
  }

  const userId = session.user.id;

  // Claves destino según el plan seleccionado. Sin plan → claves globales legacy.
  const modelsKey = plan ? `agent-models:${plan}` : "agent-models";
  const thinkingKey = plan ? `agent-thinking:${plan}` : "agent-thinking";

  // Config POR PLAN: solo se persiste en DB (la config viaja por-job en
  // _bridgeModel/_thinking resuelto desde el plan del dueño), así que NO se
  // escribe el fichero ni se reenvía al bridge.
  if (plan) {
    try {
      await prisma.setting.upsert({
        where: { key_userId: { key: modelsKey, userId } },
        create: { key: modelsKey, value: config, userId },
        update: { value: config },
      });
      if (thinking) {
        await prisma.setting.upsert({
          where: { key_userId: { key: thinkingKey, userId } },
          create: { key: thinkingKey, value: thinking, userId },
          update: { value: thinking },
        });
      }
      return { success: true, savedTo: "db", plan };
    } catch (err) {
      console.error("[saveAgentModels] plan persist failed", err);
      return { error: "Error al guardar la configuración de modelos" };
    }
  }

  try {
    // 0. Persist reasoning levels (additive). DB is the durable source the
    //    job-creation flow reads via resolveThinkingForJobAgent(). The bridge's
    //    /api/update-models only accepts model ids, so thinking is NOT forwarded
    //    there — it travels per-job in each job's _thinking field.
    if (thinking) {
      try {
        await prisma.setting.upsert({
          where: { key_userId: { key: "agent-thinking", userId } },
          create: { key: "agent-thinking", value: thinking, userId },
          update: { value: thinking },
        });
      } catch (err) {
        console.error("[saveAgentModels] thinking persist failed", err);
      }
    }

    // 1. Try to forward the model map to the local bridge daemon (fastest path).
    let bridgeOk = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${BRIDGE_URL}/api/update-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      bridgeOk = res.ok;
    } catch {
      // Bridge not reachable — fall through to file + DB
    }

    // 2. Try writing to the local file
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
    } catch {
      // File write may fail in serverless — that's expected
    }

    // 3. Always persist models to DB as reliable fallback (source of truth for
    //    resolveModelForJobAgent at job-creation time).
    await prisma.setting.upsert({
      where: { key_userId: { key: "agent-models", userId } },
      create: { key: "agent-models", value: config, userId },
      update: { value: config },
    });

    return { success: true, savedTo: bridgeOk ? "bridge+db" : "db" };
  } catch (err) {
    console.error("[saveAgentModels]", err);
    return { error: "Error al guardar la configuración de modelos" };
  }
}
