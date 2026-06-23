import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { guardIdeaOrBridge } from "@/lib/ownership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdeaOrBridge(req, id);
    if (!guard.ok) return guard.response;

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        reports: { orderBy: { createdAt: "asc" } },
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

    const reportsData = idea.reports.map((r) => ({
      title: r.title,
      agentName: r.agentName,
      verdict: r.verdict,
      scorecard: r.scorecard,
      content: r.content,
      createdAt: new Date(r.createdAt).toLocaleDateString("es-ES"),
    }));

    const exportData = {
      title: idea.title,
      description: idea.description,
      problem: idea.problem || "No especificado",
      valueProposition: idea.valueProposition || "No especificada",
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      businessModel: modelInfo ? modelInfo.label : "No especificado",
      score: idea.score,
      verdict: idea.verdict,
      status: idea.status,
      createdAt: new Date(idea.createdAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      updatedAt: new Date(idea.updatedAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      reports: reportsData,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("[GET /api/ideas/:id/export]", error);
    return NextResponse.json(
      { error: "Error al generar el informe" },
      { status: 500 }
    );
  }
}
