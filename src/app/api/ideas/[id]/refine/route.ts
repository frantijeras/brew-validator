import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";
import { assertCanRefine, incrementRefinesUsed } from "@/lib/quota";
import {
  resolveModelForJobAgent,
  resolveThinkingForJobAgent,
} from "@/lib/agent-models";

/** Campos de la idea que el refinador puede proponer reescribir. */
const REFINABLE_FIELDS = [
  "description",
  "problem",
  "valueProposition",
  "targetUser",
  "monetization",
] as const;

const refineSchema = z
  .object({
    fields: z
      .array(z.enum(REFINABLE_FIELDS))
      .min(1, "Selecciona al menos un campo")
      .max(REFINABLE_FIELDS.length),
    instruction: z.string().trim().min(1).max(2000),
  })
  .strict();

/**
 * POST /api/ideas/[id]/refine — Lanza el agente `idea-refiner` para proponer
 * una reescritura de los campos seleccionados de la idea, según la instrucción
 * del usuario.
 *
 * - Solo el dueño (guardIdea).
 * - Solo ANTES de validar: si la idea ya está validada (validationStatus DONE),
 *   se rechaza con 409 "Refina antes de validar."
 * - Cuota de refinados (assertCanRefine): 403 si está agotada.
 *
 * El resultado NO se aplica a la idea: el bridge ejecuta el job y devuelve el
 * dict de campos refinados al webhook, que lo guarda en Job.output para que la
 * UI lo previsualice y el usuario decida aceptarlo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;
    // guardIdea (sesión obligatoria) siempre devuelve un userId real aquí; el
    // tipo Guard lo declara nullable por compartirse con guards del bridge.
    const userId = guard.userId;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const parsed = refineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos no válidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fields, instruction } = parsed.data;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Solo se permite refinar ANTES de validar. Una vez validada (DONE), no.
    if (idea.validationStatus === "DONE") {
      return NextResponse.json(
        { error: "Refina antes de validar." },
        { status: 409 }
      );
    }

    // Cuota de refinados (los admins están exentos).
    const quota = await assertCanRefine(userId);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error }, { status: 403 });
    }

    const input = {
      ideaId: id,
      fields,
      instruction,
      current: {
        title: idea.title,
        description: idea.description,
        problem: idea.problem || "",
        valueProposition: idea.valueProposition || "",
        targetUser: idea.targetUser,
        monetization: idea.monetization,
        businessModel: idea.businessModel || "",
      },
      _bridgeModel: await resolveModelForJobAgent("idea-refiner", userId),
      _thinking: await resolveThinkingForJobAgent("idea-refiner", userId),
    };

    const job = await prisma.job.create({
      data: {
        ideaId: id,
        agentName: "idea-refiner",
        status: "PENDING",
        input: JSON.stringify(input),
      },
    });

    await incrementRefinesUsed(userId);

    // Marca la idea como "ocupada" (REFINING). El webhook la devuelve a un
    // estado no-busy al COMPLETAR/FALLAR y APLICA los campos refinados en el
    // servidor, así que el refinado sobrevive aunque el navegador se cierre.
    await prisma.idea.update({
      where: { id },
      data: { status: "REFINING" },
    });

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error("[POST /api/ideas/:id/refine]", error);
    return NextResponse.json(
      { error: "Error al iniciar el refinado" },
      { status: 500 }
    );
  }
}
