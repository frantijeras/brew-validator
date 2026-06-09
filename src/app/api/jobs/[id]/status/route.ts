import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const statusSchema = z.object({
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]),
  error: z.string().optional(),
});

/**
 * POST /api/jobs/:id/status
 *
 * Updates a job's status. Used by the bridge daemon to mark
 * jobs as RUNNING while processing, or FAILED if execution fails.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, error: errorMsg } = statusSchema.parse(body);

    if (status === "RUNNING") {
      // Optimistic lock: solo marcar como RUNNING si sigue PENDING
      const result = await prisma.job.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: "Job ya no está PENDING" },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    const update: Record<string, unknown> = { status };
    if (status === "FAILED" && errorMsg) {
      update.error = errorMsg;
      update.finishedAt = new Date();
    }

    await prisma.job.update({
      where: { id },
      data: update,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error("[POST /api/jobs/:id/status]", error);
    return NextResponse.json({ error: "Error al actualizar job" }, { status: 500 });
  }
}
