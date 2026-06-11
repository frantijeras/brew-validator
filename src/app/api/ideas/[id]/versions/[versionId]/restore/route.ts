import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;

    const version = await prisma.ideaVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.ideaId !== id) {
      return NextResponse.json(
        { error: "Version no encontrada" },
        { status: 404 }
      );
    }

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    if (idea.currentVersionId === version.id) {
      return NextResponse.json(
        { error: "Esta version ya esta activa" },
        { status: 400 }
      );
    }

    // Restore reports from version.reportsSnapshot if available
    if (version.reportsSnapshot) {
      const reports: Array<{
        agentName: string;
        title: string;
        content: string;
        verdict?: string;
        scorecard?: string | object;
        createdAt?: string;
      }> = Array.isArray(version.reportsSnapshot)
        ? (version.reportsSnapshot as unknown as Array<{
            agentName: string;
            title: string;
            content: string;
            verdict?: string;
            scorecard?: string | object;
            createdAt?: string;
          }>)
        : JSON.parse(version.reportsSnapshot as string);

      // Delete existing reports for this idea
      await prisma.report.deleteMany({ where: { ideaId: id } });

      // Recreate reports from snapshot
      for (const r of reports) {
        await prisma.report.create({
          data: {
            ideaId: id,
            agentName: r.agentName,
            title: r.title,
            content: r.content,
            verdict: r.verdict ?? null,
            scorecard:
              typeof r.scorecard === "string"
                ? r.scorecard
                : r.scorecard
                  ? JSON.stringify(r.scorecard)
                  : null,
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          },
        });
      }
    }

    // Update idea data from version snapshot + set currentVersionId
    const updated = await prisma.idea.update({
      where: { id },
      data: {
        title: version.title,
        description: version.description,
        problem: version.problem,
        valueProposition: version.valueProposition,
        targetUser: version.targetUser,
        monetization: version.monetization,
        score: version.score,
        verdict: version.verdict,
        status: "COMPLETED",
        validationStatus: "DONE",
        currentVersionId: version.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/ideas/:id/versions/:versionId/restore]", error);
    return NextResponse.json(
      { error: "Error al restaurar la version" },
      { status: 500 }
    );
  }
}
