import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    // 1. Get ideaId before deleting project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ideaId: true },
    });

    // 2. Delete all phases first, then the project
    await prisma.projectPhase.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });

    // 3. If idea has no other projects, delete idea (cascades to reports)
    if (project?.ideaId) {
      const otherProjects = await prisma.project.count({
        where: { ideaId: project.ideaId, id: { not: projectId } },
      });
      if (otherProjects === 0) {
        await prisma.idea.delete({ where: { id: project.ideaId } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/projects/delete]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
