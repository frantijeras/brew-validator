import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { propagateRename } from "@/lib/rename-propagate";

/**
 * POST /api/projects/[id]/rename
 *
 * Confirms a new project name during the IDENTITY `naming` sub-step.
 * This is the single source of truth for renaming a project: it updates
 * `idea.title`, `project.name`, AND propagates the change across all
 * previously generated artifacts (validation reports, market analysis,
 * etc.) so the user doesn't see the old name lingering in 14 places.
 *
 * Allowed only when:
 *  - The phase is the IDENTITY phase
 *  - The current sub-step is `naming` or `final` (re-rename allowed
 *    even after the phase is done).
 *
 * Body:
 *   { newName: string, phaseId: string }
 *
 * Response:
 *   {
 *     success: true,
 *     newName: string,
 *     ideaId: string,
 *     projectId: string,
 *     stats: RenameStats
 *   }
 *
 * If propagation fails mid-way the entire transaction is rolled back
 * and the API returns a 500. The caller is expected to surface the
 * error to the user and offer a retry.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;
    const { newName, phaseId } = await req.json();

    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return NextResponse.json({ error: "Missing newName" }, { status: 400 });
    }
    if (!phaseId) {
      return NextResponse.json({ error: "Missing phaseId" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ideaId: true, name: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    if (
      phase.type !== "IDENTITY" ||
      (phase.subStep !== "naming" && phase.subStep !== "final")
    ) {
      return NextResponse.json(
        {
          error:
            "Rename is only allowed during the naming sub-step of the branding phase",
        },
        { status: 409 }
      );
    }

    const cleanName = newName.trim();
    const oldName = project.name;

    // If the name hasn't actually changed, return early — no point
    // running the propagation.
    if (cleanName === oldName) {
      return NextResponse.json({
        success: true,
        newName: cleanName,
        ideaId: project.ideaId,
        projectId,
        stats: {
          ideaTitleChanged: false,
          projectNameChanged: false,
          artifactsUpdated: 0,
          reportsUpdated: 0,
          totalReplacements: 0,
          occurrencesByLocation: [],
        },
      });
    }

    // Single source of truth: propagateRename updates idea.title,
    // project.name, and all artifacts atomically inside a transaction.
    const stats = await propagateRename({
      ideaId: project.ideaId,
      projectId,
      oldName,
      newName: cleanName,
    });

    // Lightweight log for ops/debugging — no PII, just counters.
    console.log(
      `[POST /api/projects/[id]/rename] project=${projectId} idea=${project.ideaId} "${oldName}" → "${cleanName}" | ${stats.totalReplacements} replacements across ${stats.occurrencesByLocation.length} locations (artifacts=${stats.artifactsUpdated} reports=${stats.reportsUpdated})`
    );

    return NextResponse.json({
      success: true,
      newName: cleanName,
      ideaId: project.ideaId,
      projectId,
      stats,
    });
  } catch (error) {
    console.error("[POST /api/projects/[id]/rename]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
