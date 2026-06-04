import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;

    const version = await prisma.ideaVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.ideaId !== id) {
      return NextResponse.json(
        { error: "Versión no encontrada" },
        { status: 404 }
      );
    }

    // Determine current (latest) version
    const latestVersion = await prisma.ideaVersion.findFirst({
      where: { ideaId: id },
      orderBy: { createdAt: "desc" },
    });

    if (latestVersion && version.id === latestVersion.id) {
      return NextResponse.json(
        { error: "Esta versión ya está activa" },
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

    // Update idea with restored fields
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
      },
    });

    // Create new IdeaVersion reflecting the restored state
    const versionCount = await prisma.ideaVersion.count({ where: { ideaId: id } });
    const newPhase = `v${versionCount + 1}`;

    await prisma.ideaVersion.create({
      data: {
        ideaId: id,
        title: version.title,
        description: version.description,
        problem: version.problem,
        valueProposition: version.valueProposition,
        targetUser: version.targetUser,
        monetization: version.monetization,
        phase: newPhase,
        score: version.score,
        verdict: version.verdict,
        reportsSnapshot: version.reportsSnapshot ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/ideas/:id/versions/:versionId/restore]", error);
    return NextResponse.json(
      { error: "Error al restaurar la versión" },
      { status: 500 }
    );
  }
}
