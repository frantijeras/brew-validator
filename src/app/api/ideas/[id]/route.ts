import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { backfillReportVersionId } from "@/lib/backfill-report-version";

let reportBackfillRan = false;

const updateIdeaSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  problem: z.string().optional().nullable(),
  valueProposition: z.string().optional().nullable(),
  targetUser: z.string().min(3).optional(),
  monetization: z.string().min(3).optional(),
  status: z.string().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const requestedVersionId = searchParams.get("versionId");

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { createdAt: "asc" },
        },
        currentVersion: {
          select: { phase: true },
        },
        _count: {
          select: { versions: true },
        },
      },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // One-time backfill of Report.ideaVersionId on first request
    if (!reportBackfillRan) {
      reportBackfillRan = true;
      backfillReportVersionId().catch((err) =>
        console.error("[backfillReportVersionId] error:", err)
      );
    }

    // If a specific version was requested, reshape the response so the
    // UI shows what this idea looked like AT that version: snap the
    // idea's text fields to the IdeaVersion snapshot, filter the
    // reports to those linked to that version, and override the version
    // phase accordingly.
    let activeVersionId: string | null = idea.currentVersionId;
    let activeVersionPhase: string | null = idea.currentVersion?.phase ?? null;
    let activeReports = idea.reports;
    let overrideFields: Partial<{
      title: string;
      description: string;
      problem: string | null;
      valueProposition: string | null;
      targetUser: string;
      monetization: string;
      score: number | null;
      verdict: string | null;
      status: string;
      validationStatus: string;
    }> = {};

    if (requestedVersionId) {
      const version = await prisma.ideaVersion.findUnique({
        where: { id: requestedVersionId },
      });
      if (version && version.ideaId === id) {
        activeVersionId = version.id;
        activeVersionPhase = version.phase;
        activeReports = idea.reports.filter(
          (r) => r.ideaVersionId === version.id
        );
        // Map IdeaVersion snapshot back to the idea-shaped response so
        // the page renders the version's text/fields verbatim.
        overrideFields = {
          title: version.title,
          description: version.description,
          problem: version.problem,
          valueProposition: version.valueProposition,
          targetUser: version.targetUser,
          monetization: version.monetization,
          score: version.score,
          verdict: version.verdict,
        };
      }
    }

    // Flatten _count and currentVersion into response
    const { _count, currentVersion: _cv, ...ideaData } = idea;
    return NextResponse.json({
      ...ideaData,
      ...overrideFields,
      reports: activeReports,
      _versionCount: _count.versions,
      currentVersionPhase: activeVersionPhase,
      activeVersionId,
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al obtener la idea" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateIdeaSchema.parse(body);

    // Cast status to IdeaStatus if present
    const updateData: Record<string, unknown> = { ...data };

    const idea = await prisma.idea.update({
      where: { id },
      data: updateData as Record<string, unknown>,
    });

    return NextResponse.json(idea);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al actualizar la idea" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Cascade: delete versions, reports and jobs first, then the idea
    await prisma.$transaction([
      prisma.ideaVersion.deleteMany({ where: { ideaId: id } }),
      prisma.report.deleteMany({ where: { ideaId: id } }),
      prisma.job.deleteMany({ where: { ideaId: id } }),
      prisma.idea.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al eliminar la idea" },
      { status: 500 }
    );
  }
}
