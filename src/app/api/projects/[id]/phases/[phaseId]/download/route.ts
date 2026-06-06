import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/projects/[id]/phases/[phaseId]/download
 *
 * Returns the first artifact of the phase as a `.md` file.
 * The frontend triggers a download via a hidden <a download> link.
 *
 * - 200: text/markdown body with Content-Disposition: attachment
 * - 404: project or phase not found
 * - 409: phase is not COMPLETED or has no artifacts yet
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id, phaseId } = await params;

    const phase = await prisma.projectPhase.findUnique({
      where: { id: phaseId },
      include: { project: true },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.projectId !== id) {
      return NextResponse.json({ error: "Phase does not belong to project" }, { status: 404 });
    }

    const artifacts = phase.artifacts as Array<{ title?: string; content?: string; type?: string }> | null;
    const first = artifacts && artifacts.length > 0 ? artifacts[0] : null;
    if (!first || !first.content) {
      return NextResponse.json(
        { error: "No hay artefacto disponible para esta fase" },
        { status: 409 }
      );
    }

    const safeTitle = (first.title || phase.label || "artifact")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact";

    const filename = `${safeTitle}.md`;

    return new NextResponse(first.content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/phases/[phaseId]/download]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
