import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { buildBrandBookFromPhase, brandBookToMarkdown } from "@/lib/identity-brandbook";
import { ZipArchive } from "archiver";
import type { ProjectMemory } from "@/lib/project-memory";

/**
 * GET /api/projects/export?projectId=xxx
 *
 * Generates a full-project export ZIP containing:
 *   - /contexto/ — Phase reports as markdown files
 *   - /identidad-marca.md — Brand book (single file) if the IDENTITY phase is completed
 *   - /skills/ — Selected skills as markdown files
 *   - README.md — Project summary
 *
 * Uses archiver (same as handoff-builder).
 */

interface PhaseExportData {
  type: string;
  label: string;
  sortOrder: number;
  status: string;
  artifacts: Array<{ title: string; content: string; type: string }> | null;
  subStepArtifact: {
    type?: "html" | "markdown";
    content?: string;
    title?: string;
  } | null;
  subStepChoice: string | null;
  subStep: string | null;
  subStepHistory: unknown;
}

interface SkillExportData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  confidence: number;
  reason: string;
  recommended: boolean;
  selected?: boolean;
  custom?: boolean;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "proyecto";
}

function getPhaseContent(phase: PhaseExportData): string | null {
  // IDENTITY is handled separately (consolidated Brand Book), never as a raw
  // sub-step artifact — skip it here to avoid emitting the visual JSON.
  if (phase.type === "IDENTITY") return null;

  // Otherwise, first artifact
  if (phase.artifacts && phase.artifacts.length > 0) {
    const first = phase.artifacts[0];
    if (first.content) return first.content;
  }

  return null;
}

function buildReadme(
  projectName: string,
  idea: {
    title: string;
    description: string;
    problem: string | null;
    valueProposition: string | null;
    targetUser: string;
    monetization: string;
    businessModel: string | null;
  },
  phases: PhaseExportData[],
  skills: SkillExportData[],
  memory: ProjectMemory | null,
): string {
  const completedPhases = phases.filter((p) => p.status === "COMPLETED");
  const selectedSkills = skills.filter((s) => s.selected);

  return [
    `# ${projectName}`,
    "",
    "> Paquete de exportación completo generado por **BrewValidator**.",
    "",
    `**Fecha:** ${new Date().toISOString().split("T")[0]}`,
    "",
    "---",
    "",
    "## 📋 Idea",
    "",
    `- **Título:** ${idea.title}`,
    `- **Descripción:** ${idea.description}`,
    `- **Problema:** ${idea.problem || "—"}`,
    `- **Propuesta de valor:** ${idea.valueProposition || "—"}`,
    `- **Target:** ${idea.targetUser}`,
    `- **Monetización:** ${idea.monetization}`,
    `- **Modelo de negocio:** ${idea.businessModel || "—"}`,
    "",
    "---",
    "",
    "## 📦 Contenido del paquete",
    "",
    "| Archivo | Contenido |",
    "|---------|-----------|",
    "| `README.md` | Resumen general del proyecto |",
    "| `01-analisis-mercado.md` | Análisis de mercado |",
    "| `02-estrategia-negocio.md` | Estrategia de negocio |",
    "| `03-identidad-marca.md` | Brand book y identidad |",
    "| `04-estrategia-distribucion.md` | Estrategia de distribución |",
    "| `05-roadmap.md` | Roadmap de ejecución |",
    "| `skills/` | Skills seleccionadas para este proyecto |",
    "",
    "---",
    "",
    "## ✅ Fases completadas",
    "",
    ...completedPhases.map(
      (p) => `- **Fase ${p.sortOrder} — ${p.label}**`,
    ),
    "",
    completedPhases.length === 0
      ? "⚠️ Ninguna fase completada aún."
      : "",
    "",
    "---",
    "",
    "## 🛠️ Skills seleccionadas",
    "",
    ...selectedSkills.map(
      (s) => `- **${s.name}** — ${s.description}`,
    ),
    "",
    selectedSkills.length === 0
      ? "No hay skills seleccionadas."
      : "",
    "",
    "---",
    "",
    `_Generado por BrewValidator el ${new Date().toISOString()}_`,
  ].join("\n");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Se requiere projectId" },
        { status: 400 },
      );
    }

    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        idea: true,
        phases: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    const idea = project.idea;
    if (!idea) {
      return NextResponse.json(
        { error: "El proyecto no tiene una idea asociada" },
        { status: 404 },
      );
    }

    const phases: PhaseExportData[] = project.phases.map((p) => ({
      type: p.type,
      label: p.label,
      sortOrder: p.sortOrder,
      status: p.status,
      artifacts: p.artifacts as Array<{
        title: string;
        content: string;
        type: string;
      }> | null,
      subStepArtifact: p.subStepArtifact as {
        type?: "html" | "markdown";
        content?: string;
        title?: string;
      } | null,
      subStepChoice: p.subStepChoice,
      subStep: p.subStep,
      subStepHistory: p.subStepHistory,
    }));

    const skills: SkillExportData[] =
      ((project.skills as unknown as SkillExportData[]) ?? []);
    const memory = project.memory as ProjectMemory | null;

    // ── Build ZIP with archiver ──
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", (err: Error) => reject(err));

      const prefix = `${sanitizeFilename(project.name)}/`;

      // ── README.md ──
      archive.append(
        buildReadme(project.name, idea, phases, skills, memory),
        { name: `${prefix}README.md` },
      );

      // ── Phase reports (at root level) ──
      const completedPhases = phases.filter(
        (p) => p.status === "COMPLETED",
      );
      for (const phase of completedPhases) {
        const content = getPhaseContent(phase);
        if (!content) continue;

        const filename = `${String(phase.sortOrder).padStart(2, "0")}-${sanitizeFilename(phase.label)}.md`;
        archive.append(
          `# ${phase.label}\n\n${content}`,
          { name: `${prefix}${filename}` },
        );
      }

      // ── Identity: single file at root (03-identidad-marca.md) ──
      const identityPhase = phases.find(
        (p) => p.type === "IDENTITY" && p.status === "COMPLETED",
      );
      if (identityPhase) {
        // Consolidate the 3 sub-steps (naming + voice + visual) into a single
        // Brand Book document, reading each chosen option from subStepHistory.
        try {
          const brandBook = buildBrandBookFromPhase(identityPhase, project.name, {
            description: project.description,
          });

          archive.append(
            brandBookToMarkdown(brandBook),
            { name: `${prefix}03-identidad-marca.md` },
          );
        } catch (err) {
          console.error("[export] BrandBook build failed:", err);
        }
      }

      // ── /skills/ — Selected skills ──
      const selectedSkills = skills.filter((s) => s.selected);
      for (const skill of selectedSkills) {
        const filename = `${sanitizeFilename(skill.name)}.md`;
        const content = [
          `# ${skill.name}`,
          "",
          `> ${skill.description}`,
          "",
          `- **Categoría:** ${skill.category}`,
          `- **Confianza:** ${(skill.confidence * 100).toFixed(0)}%`,
          `- **Razón:** ${skill.reason}`,
          skill.custom ? "- **Tipo:** Personalizada" : "",
        ]
          .filter(Boolean)
          .join("\n");

        archive.append(content, { name: `${prefix}skills/${filename}` });
      }

      // If no selected skills, add a placeholder
      if (selectedSkills.length === 0) {
        archive.append(
          `# Skills — ${project.name}\n\nNo hay skills seleccionadas para este proyecto.`,
          { name: `${prefix}skills/README.md` },
        );
      }

      void archive.finalize();
    });

    // ── Response ──
    const safeName = sanitizeFilename(project.name);
    const filename = `${safeName}-export.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/export]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
