import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BUSINESS_MODELS } from "@/lib/business-models";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        reports: { orderBy: { createdAt: "asc" } },
        versions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    const modelInfo = idea.businessModel
      ? BUSINESS_MODELS.find((m) => m.value === idea.businessModel)
      : null;

    const reportBlock =
      idea.reports.length > 0
        ? idea.reports
            .map(
              (r) => `
### ${r.title} (${r.agentName})
- **Veredicto:** ${r.verdict ?? "—"}
- **Scorecard:** ${r.scorecard ?? "—"}
- **Fecha:** ${new Date(r.createdAt).toLocaleDateString("es-ES")}

${r.content}
`
            )
            .join("\n---\n")
        : "Sin reportes de validación.";

    const versionsBlock =
      idea.versions.length > 0
        ? idea.versions
            .map(
              (v) =>
                `- **${v.title}** (fase: ${v.phase}) — ${new Date(v.createdAt).toLocaleDateString("es-ES")}`
            )
            .join("\n")
        : "Sin versiones guardadas.";

    const markdown = `# ${idea.title}

**Modelo de negocio:** ${modelInfo ? `${modelInfo.icon} ${modelInfo.label}` : "No especificado"}
**Score:** ${idea.score !== null ? `${idea.score}/10` : "—"}
**Veredicto:** ${idea.verdict ?? "—"}
**Estado:** ${idea.status}
**Creada:** ${new Date(idea.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
**Última modificación:** ${new Date(idea.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}

---

## 📝 Descripción

${idea.description}

## ❓ Problema

${idea.problem || "No especificado"}

## 💡 Propuesta de valor

${idea.valueProposition || "No especificada"}

## 🎯 Usuario objetivo

${idea.targetUser}

## 💰 Monetización

${idea.monetization}

---

## 🔍 Resultados de validación

**Puntuación:** ${idea.score !== null ? `${idea.score}/10` : "Pendiente"}
**Veredicto:** ${idea.verdict ?? "Pendiente"}

### 📊 Reportes

${reportBlock}

---

## 📜 Historial de versiones

${versionsBlock}

---

_Informe generado por Brew Validator el ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}_
`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slugify(idea.title)}-informe.md"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id/export]", error);
    return NextResponse.json(
      { error: "Error al generar el informe" },
      { status: 500 }
    );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
