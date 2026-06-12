import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { buildHandoffZip, type HandoffOptions } from "@/lib/handoff-builder";
import type { ProjectMemory } from "@/lib/project-memory";

/**
 * GET /api/projects/export?projectId=xxx
 *
 * Exporta el paquete del proyecto (Handoff) como ZIP. Delega en el builder
 * canónico `buildHandoffZip` para producir la MISMA estructura nueva que
 * /api/projects/[id]/handoff: `.md` numerados (sin naming, sin Brand Book) +
 * `skills/` con los assets técnicos (3c-logos, 3d-assets) y las skills de
 * marketing seleccionadas.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Se requiere projectId" }, { status: 400 });
    }

    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { idea: true, phases: { orderBy: { sortOrder: "asc" } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    const idea = project.idea;
    if (!idea) {
      return NextResponse.json(
        { error: "El proyecto no tiene una idea asociada" },
        { status: 404 }
      );
    }

    const selectedSkills = (project.skills as Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      confidence?: number;
      reason?: string;
      recommended?: boolean;
      selected?: boolean;
      custom?: boolean;
    }> | null)?.filter((s) => s.selected !== false) ?? [];

    const generatedSkills = (project.generatedSkills as Array<{
      id: string;
      name: string;
      content: string;
    }> | null) ?? null;

    const handoffOptions: HandoffOptions = {
      projectId: project.id,
      projectName: project.name,
      ideaContext: {
        title: idea.title,
        description: idea.description,
        problem: idea.problem || "",
        valueProposition: idea.valueProposition || "",
        targetUser: idea.targetUser,
        monetization: idea.monetization,
        businessModel: idea.businessModel || "",
      },
      phases: project.phases.map((p) => ({
        type: p.type,
        label: p.label,
        sortOrder: p.sortOrder,
        status: p.status,
        description: p.description,
        artifacts: p.artifacts as Array<{ title: string; content: string; type: string }> | null,
        subStepArtifact: p.subStepArtifact as {
          type?: string;
          content?: string;
          options?: Array<{ value: string; label: string }>;
        } | null,
        subStepChoice: p.subStepChoice,
        subStep: p.subStep,
        subStepHistory: p.subStepHistory,
      })),
      memory: project.memory as ProjectMemory | null,
      selectedSkills,
      generatedSkills,
    };

    const zipBuffer = await buildHandoffZip(handoffOptions);

    const safeName =
      project.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "proyecto";

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}-handoff.zip"`,
        "Content-Length": zipBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/export]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
