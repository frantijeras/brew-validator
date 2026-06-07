import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getVisualOption,
  parseVisualArtifactContent,
} from "@/lib/identity-visual";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/visual-download?variant=A|B|C
 *
 * Devuelve el HTML crudo de la variante solicitada del style guide
 * visual (subStep `visual` de la fase IDENTITY) como attachment.
 *
 * Por qué existe este endpoint:
 *  - El modal muestra el HTML dentro de un `<iframe srcDoc>`, lo que
 *    significa que el usuario no puede hacer "Guardar como…" sobre
 *    ese contenido.
 *  - El botón "Descargar HTML" del modal hace una petición a este
 *    endpoint con `?variant=A|B|C` y dispara la descarga nativa del
 *    navegador (gracias al header `Content-Disposition: attachment`).
 *
 * Auth: implícita (las páginas de proyecto requieren sesión). El
 * projectId de la URL se cruza con el phaseId en la query de Prisma
 * para evitar fuga entre cuentas.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const url = new URL(req.url);
    const rawVariant = (url.searchParams.get("variant") || "A").toUpperCase();
    if (rawVariant !== "A" && rawVariant !== "B" && rawVariant !== "C") {
      return NextResponse.json(
        { error: "Invalid variant. Expected A, B or C." },
        { status: 400 }
      );
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.subStep !== "visual") {
      return NextResponse.json(
        { error: "Phase is not on the `visual` sub-step" },
        { status: 409 }
      );
    }

    const artifact = phase.subStepArtifact as
      | { type?: string; content?: string }
      | null;
    const parsed = parseVisualArtifactContent(artifact?.content);
    if (!parsed) {
      return NextResponse.json(
        { error: "No visual style guide artifact available" },
        { status: 404 }
      );
    }

    const option = getVisualOption(parsed, rawVariant);
    if (!option) {
      return NextResponse.json(
        { error: `Variant ${rawVariant} not found in artifact` },
        { status: 404 }
      );
    }

    // Use a stable, file-system-friendly slug for the variant.
    const filename = `style-guide-${rawVariant}.html`;
    return new NextResponse(option.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/substep/visual-download]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
