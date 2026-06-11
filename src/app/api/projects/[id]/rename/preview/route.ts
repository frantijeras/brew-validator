import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { previewRename } from "@/lib/rename-propagate";

/**
 * GET /api/projects/[id]/rename/preview?newName=...
 *
 * Dry-run of the rename propagation: estimates how many occurrences of
 * the current project name would be rewritten across all artifacts
 * (validation reports, market analysis, brand book, etc.) WITHOUT
 * touching the database. Used by the UI to show a "Vas a renombrar a
 * **X**. Se actualizarán N menciones en M documentos" confirmation
 * dialog before the user commits the rename.
 *
 * Query params:
 *   - newName: the new name the user is considering. We only need this
 *     to skip the call if the name hasn't actually changed (no
 *     propagation needed). The replacement work itself is name-agnostic
 *     (counts of old name), so we use the project's current name as the
 *     pattern.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;
    const url = new URL(req.url);
    const newName = url.searchParams.get("newName") ?? "";

    if (!newName || !newName.trim()) {
      return NextResponse.json(
        { error: "Missing newName query param" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ideaId: true, name: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const cleanNew = newName.trim();
    if (cleanNew === project.name) {
      // No-op rename: nothing would change.
      return NextResponse.json({
        projectId,
        currentName: project.name,
        newName: cleanNew,
        occurrencesByLocation: [],
        totalReplacements: 0,
        totalDocuments: 0,
      });
    }

    const stats = await previewRename({
      ideaId: project.ideaId,
      projectId,
      oldName: project.name,
    });

    return NextResponse.json({
      projectId,
      currentName: project.name,
      newName: cleanNew,
      ...stats,
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/rename/preview]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
