import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { buildReportHtml } from "@/lib/report-renderer";
import { buildReportPdf } from "@/lib/pdf-export";
import { getChosenLogoSvg, numberLogoHtml } from "@/lib/identity-logo";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/history?subStep=<id>&action=view|download[&svg=N]
 *
 * Sirve el artefacto de un sub-paso YA CONFIRMADO de la Fase 3, leyéndolo de
 * `subStepHistory[subStep]` (tras avanzar, `subStepArtifact` ya contiene el del
 * sub-paso siguiente, por eso usamos el historial).
 *
 * Tipos de salida por sub-paso:
 *  - naming / voice  → markdown. `action=view` → HTML renderizado (inline);
 *    `action=download` → PDF (`<subStep>.pdf`).
 *  - logo            → HTML con los 12 logos. `action=view` → HTML inline;
 *    `action=download` → SVG elegido (`logo.svg`) si `svg`/choice, o el HTML.
 *
 * Para el sub-paso `visual` (3d) usa los endpoints dedicados `3d/view`,
 * `3d/template` y `3d/styleguide`.
 */

const TITLES: Record<string, string> = {
  naming: "Naming",
  voice: "Voz y Tono",
  logo: "Logotipos",
  visual: "Estilo Visual y Maqueta",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const url = new URL(req.url);
    const subStep = url.searchParams.get("subStep") || "";
    const action = url.searchParams.get("action") || "view";
    if (!subStep) {
      return NextResponse.json({ error: "Missing subStep" }, { status: 400 });
    }

    const [phase, project] = await Promise.all([
      prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    ]);
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const history =
      phase.subStepHistory && typeof phase.subStepHistory === "object"
        ? (phase.subStepHistory as Record<
            string,
            { choice?: string; artifact?: { type?: string; content?: string } | null }
          >)
        : null;
    const entry = history?.[subStep];
    const content = entry?.artifact?.content;
    if (!content) {
      return NextResponse.json(
        { error: `No hay artefacto para el sub-paso "${subStep}"` },
        { status: 404 }
      );
    }

    const projectName = project?.name || "Proyecto";
    const title = `${TITLES[subStep] || subStep} — ${projectName}`;
    const isHtml = entry?.artifact?.type === "html" || subStep === "logo";

    // ── JSON (para render inline en la subpágina oscura, sin iframe) ──
    if (action === "json") {
      if (subStep === "logo") {
        return NextResponse.json(
          { title, content: numberLogoHtml(content), contentType: "html" },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { title, content, contentType: isHtml ? "html" : "markdown" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── LOGO (HTML con 12 SVG) ──
    if (subStep === "logo") {
      if (action === "download") {
        const svgParam = url.searchParams.get("svg");
        if (svgParam != null) {
          const svg = getChosenLogoSvg(content, svgParam === "" ? entry?.choice : svgParam);
          if (svg) {
            return new NextResponse(svg, {
              status: 200,
              headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Content-Disposition": `attachment; filename="logo.svg"`,
                "Cache-Control": "no-store",
              },
            });
          }
        }
        return new NextResponse(content, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="logos-options.html"`,
            "Cache-Control": "no-store",
          },
        });
      }
      // view → el HTML de los 12 logos (numerados), inline.
      return new NextResponse(numberLogoHtml(content), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // ── naming / voice (markdown) ──
    if (action === "download") {
      const pdf = buildReportPdf({
        title,
        content,
        phaseType: "IDENTITY",
        projectName,
      });
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${subStep}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    // view → HTML renderizado del markdown.
    const html = buildReportHtml({
      title,
      content,
      contentType: isHtml ? "html" : "markdown",
      projectName,
      phaseType: "IDENTITY",
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[GET .../substep/history]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
