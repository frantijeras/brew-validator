import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const LIMIT_REQUEST_TYPES = [
  "ideas",
  "projects",
  "phase_undo",
  "skills",
  "handoff",
  "refine",
] as const;

const createSchema = z
  .object({
    type: z.enum(LIMIT_REQUEST_TYPES),
    message: z.string().max(1000).optional(),
  })
  .strict();

/**
 * POST /api/limit-requests — Un usuario (cualquiera, normalmente invitado en
 * modo demo) solicita al admin ampliar un límite o desbloquear un acceso.
 *
 * Dedupe: si ya existe una solicitud PENDING del mismo tipo de este usuario, se
 * devuelve esa misma (no se crea una duplicada).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos no válidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, message } = parsed.data;
  const userId = session.user.id;

  // Dedupe: una sola solicitud PENDING por tipo y usuario.
  const existing = await prisma.limitRequest.findFirst({
    where: { userId, type, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json({ ok: true, request: existing });
  }

  const request = await prisma.limitRequest.create({
    data: { userId, type, message, status: "PENDING" },
  });

  return NextResponse.json({ ok: true, request });
}
