import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ideaOwnerWhere } from "@/lib/ownership";
import { verifyBridgeSecret } from "@/lib/bridge-auth";
import { assertCanCreateIdea, incrementIdeasCreated } from "@/lib/quota";

const createIdeaSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  targetUser: z.string().min(3, "Indica quién es tu usuario objetivo"),
  monetization: z.string().min(3, "Describe tu modelo de monetización"),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const data = createIdeaSchema.parse(body);

    // Misma cuota que /generate (crear idea manual no debe saltarse maxIdeas).
    const quota = await assertCanCreateIdea(auth.userId);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error }, { status: 403 });
    }

    const ideaData = {
      title: data.title,
      description: data.description,
      originalIdea: data.description,
      targetUser: data.targetUser,
      monetization: data.monetization,
      userId: auth.userId,
    };

    const idea = await prisma.idea.create({ data: ideaData });
    await incrementIdeasCreated(auth.userId);

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas]", error);
    return NextResponse.json(
      { error: "Error al crear la idea" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // ── Acceso del Bridge (Puente con las APIs de IA) ──
    // El daemon de validación lee con su BRIDGE_SECRET (no tiene sesión de
    // usuario) las ideas que están EN VALIDACIÓN (validationStatus RUNNING)
    // para ejecutar los agentes skeptic/advocate/judge. Es un acceso de
    // sistema (todas las ideas en validación), distinto del listado por
    // usuario de abajo. Sin este branch, el bridge recibía 401 y la validación
    // se quedaba colgada.
    if (verifyBridgeSecret(req)) {
      const running = await prisma.idea.findMany({
        where: { validationStatus: "RUNNING" },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json(running);
    }

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const ideas = await prisma.idea.findMany({
      where: ideaOwnerWhere(auth.userId),
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(ideas);
  } catch (error) {
    console.error("[GET /api/ideas]", error);
    return NextResponse.json(
      { error: "Error al obtener las ideas" },
      { status: 500 }
    );
  }
}
