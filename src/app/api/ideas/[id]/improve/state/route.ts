import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";

/**
 * GET /api/ideas/[id]/improve/state — Estado/sub-paso actual del flujo "Mejorar
 * idea según el veredicto", para que la UI sea RESUMABLE: si el usuario se va y
 * vuelve a mitad del flujo (idea en IMPROVING), la página recupera aquí el
 * sub-paso y lo restaura.
 *
 * Solo el dueño (guardIdea). Determina la fase a partir de los jobs del agente
 * `idea-improver` de esta idea (el más reciente manda), distinguiendo el modo
 * (questions | report) leyendo job.input:
 *  - APPLY (mode "report") PENDING/RUNNING → { phase: "applying" }
 *  - QUESTIONS PENDING/RUNNING            → { phase: "generating", jobId }
 *  - QUESTIONS COMPLETED sin apply posterior → { phase: "quiz", questions, jobId }
 *  - en otro caso                          → { phase: "none" }
 */

type ImproverMode = "questions" | "report" | null;

/** Lee el modo del mejorador desde job.input (no nos fiamos del exterior). */
function readMode(input: string | null): ImproverMode {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input) as { mode?: unknown };
    if (parsed.mode === "questions" || parsed.mode === "report") {
      return parsed.mode;
    }
  } catch {
    // input malformado → modo desconocido
  }
  return null;
}

/** Extrae el array de preguntas de job.output ({questions:[...]}). */
function parseQuestions(output: string | null): unknown[] {
  if (!output) return [];
  try {
    const obj = JSON.parse(output) as { questions?: unknown };
    return Array.isArray(obj.questions) ? obj.questions : [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;

    const jobs = await prisma.job.findMany({
      where: { ideaId: id, agentName: "idea-improver" },
      orderBy: { createdAt: "desc" },
    });

    // Anota cada job con su modo para razonar sobre las fases.
    const annotated = jobs.map((j) => ({ job: j, mode: readMode(j.input) }));

    // 1) ¿Hay un APPLY (report) en curso? → aplicando.
    const applying = annotated.find(
      (a) =>
        a.mode === "report" &&
        (a.job.status === "PENDING" || a.job.status === "RUNNING")
    );
    if (applying) {
      return NextResponse.json({ phase: "applying" });
    }

    // 2) ¿Hay un job de QUESTIONS en curso? → generando preguntas.
    const generating = annotated.find(
      (a) =>
        a.mode === "questions" &&
        (a.job.status === "PENDING" || a.job.status === "RUNNING")
    );
    if (generating) {
      return NextResponse.json({
        phase: "generating",
        jobId: generating.job.id,
      });
    }

    // 3) ¿QUESTIONS COMPLETED sin un apply posterior? → quiz (resumible).
    //    "más reciente primero" implica que si hubiera un apply posterior,
    //    habría salido en (1). Aquí basta el primer questions COMPLETED.
    const quiz = annotated.find(
      (a) => a.mode === "questions" && a.job.status === "COMPLETED"
    );
    if (quiz) {
      return NextResponse.json({
        phase: "quiz",
        jobId: quiz.job.id,
        questions: parseQuestions(quiz.job.output),
      });
    }

    // 4) Nada en curso ni pendiente del flujo de mejora.
    return NextResponse.json({ phase: "none" });
  } catch (error) {
    console.error("[GET /api/ideas/:id/improve/state]", error);
    return NextResponse.json(
      { error: "Error al obtener el estado de la mejora" },
      { status: 500 }
    );
  }
}
