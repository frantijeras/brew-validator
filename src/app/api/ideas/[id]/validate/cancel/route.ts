import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    if (idea.validationStatus !== "RUNNING") {
      return NextResponse.json(
        { error: "La validación no está en curso" },
        { status: 409 }
      );
    }

    // Mark all PENDING/RUNNING jobs for this idea as CANCELLED, and
    // delete any reports that were already written. The idea itself goes
    // back to its pre-validation status (or DRAFT if it was a first run).
    // validate/route.ts keeps score/verdict when starting a run precisely
    // so we can tell a revalidation apart here (reports are already gone).
    const wasRevalidation = idea.score !== null || idea.verdict !== null;
    const nextStatus = wasRevalidation ? "COMPLETED" : "DRAFT";

    await prisma.$transaction([
      prisma.job.updateMany({
        where: {
          ideaId: id,
          status: { in: ["PENDING", "RUNNING"] },
        },
        data: { status: "CANCELLED" },
      }),
      prisma.report.deleteMany({ where: { ideaId: id } }),
      prisma.idea.update({
        where: { id },
        data: {
          status: nextStatus,
          validationStatus: "CANCELLED",
          // Keep the previous score/verdict on a cancelled revalidation;
          // they still describe the last completed run.
          ...(wasRevalidation ? {} : { score: null, verdict: null }),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("[POST /api/ideas/:id/validate/cancel]", error);
    return NextResponse.json(
      { error: "Error al cancelar la validación" },
      { status: 500 }
    );
  }
}
