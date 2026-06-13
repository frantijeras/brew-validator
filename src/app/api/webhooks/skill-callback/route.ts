import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/bridge-auth";
import type { GeneratedSkill } from "@/lib/skill-types";

/**
 * POST /api/webhooks/skill-callback
 *
 * El daemon postea aquí el resultado de mejorar una skill con IA
 * (Job `project-skills`). Guarda el markdown generado en
 * `generatedSkills[skill]` con `source: "ai"` y marca el Job COMPLETED.
 * En fallo: marca el Job FAILED y revierte la skill de "ai-pending" a
 * "template" (conservando el contenido previo) para no dejarla colgada.
 *
 * Body: { jobId, status: "COMPLETED"|"FAILED", output?, skillId, projectId, skillName?, error? }
 */

/** Extrae el markdown del output del agente (tolera JSON {content}/fences). */
function extractMarkdown(output: unknown): string {
  if (output == null) return "";
  let s = typeof output === "string" ? output : JSON.stringify(output);
  s = s.trim();
  // Si viene como JSON {"content": "..."} (o markdown/reportMarkdown), extrae.
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      const c = obj.content ?? obj.markdown ?? obj.reportMarkdown;
      if (typeof c === "string" && c.trim()) s = c.trim();
    } catch {
      /* no era JSON; seguimos con el texto */
    }
  }
  // Quita fences ```markdown ... ``` envolventes si los hay.
  const fence = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1].trim();
  return s;
}

export async function POST(req: Request) {
  try {
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { jobId, status, output, skillId, projectId, skillName, error } = body as {
      jobId?: string;
      status?: string;
      output?: unknown;
      skillId?: string;
      projectId?: string;
      skillName?: string;
      error?: string;
    };

    if (!jobId || !status || !skillId || !projectId) {
      return NextResponse.json(
        { error: "Missing jobId/status/skillId/projectId" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    // Idempotencia: si el job ya es terminal, ack y salir.
    if (job && (job.status === "COMPLETED" || job.status === "FAILED")) {
      return NextResponse.json({ ok: true, skipped: "job already terminal" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { generatedSkills: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const existing: GeneratedSkill[] = Array.isArray(project.generatedSkills)
      ? (project.generatedSkills as unknown as GeneratedSkill[])
      : [];
    const byId = new Map(existing.map((g) => [g.id, g]));
    const prev = byId.get(skillId);

    const content = status === "COMPLETED" ? extractMarkdown(output) : "";

    if (status === "COMPLETED" && content) {
      byId.set(skillId, {
        id: skillId,
        name: skillName || prev?.name || skillId,
        content,
        source: "ai",
      });
    } else {
      // Fallo o salida vacía: revierte el marcador "ai-pending".
      if (prev) {
        byId.set(skillId, {
          ...prev,
          source: prev.content ? "template" : prev.source,
        });
      }
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        generatedSkills: Array.from(byId.values()) as unknown as Prisma.InputJsonValue,
      },
    });

    if (job) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: status === "COMPLETED" && content ? "COMPLETED" : "FAILED",
          output: typeof output === "string" ? output : JSON.stringify(output ?? ""),
          error: status !== "COMPLETED" ? error || "Agent returned no output" : null,
          finishedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/skill-callback]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
