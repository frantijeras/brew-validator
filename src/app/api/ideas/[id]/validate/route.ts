import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelForJobAgent } from "@/lib/agent-models";
import { isIdeaBusy } from "@/lib/idea-state";
import { guardIdea } from "@/lib/ownership";
import { getBridgeHealth, BRIDGE_OFFLINE_MESSAGE } from "@/lib/bridge/health";

const AGENTS = ["skeptic", "advocate", "judge"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    if (isIdeaBusy(idea.status)) {
      return NextResponse.json(
        { error: `No se puede validar una idea en estado ${idea.status}. Espera a que termine.` },
        { status: 409 }
      );
    }

    if (idea.validationStatus === "RUNNING") {
      return NextResponse.json(
        { error: "La validación ya está en curso" },
        { status: 409 }
      );
    }

    // FAIL-FAST: no arrancar validación si el bridge no está vivo.
    if (process.env.BRIDGE_FAILFAST !== "off") {
      const health = await getBridgeHealth();
      if (!health.reachable) {
        return NextResponse.json(
          { error: BRIDGE_OFFLINE_MESSAGE, reason: health.reason },
          { status: 503 }
        );
      }
    }

    // Delete old reports and jobs but keep score/verdict so
    // the webhook can tell if this is a first validation or revalidation
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { ideaId: id } }),
      prisma.job.deleteMany({ where: { ideaId: id } }),
      prisma.idea.update({
        where: { id },
        data: {
          status: "VALIDATING",
          validationStatus: "RUNNING",
        },
      }),
    ]);

    // Create 3 PENDING jobs — each with its configured model from Settings.
    // Input enriquecido: además de lo básico, pasamos problema, propuesta de
    // valor y tipo de negocio para que skeptic/advocate/judge investiguen y
    // juzguen con el contexto completo (no solo título+descripción).
    const baseInput = {
      title: idea.title,
      description: idea.description,
      problem: idea.problem || "",
      valueProposition: idea.valueProposition || "",
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      businessModel: idea.businessModel || "",
    };

    const jobs = await Promise.all(
      AGENTS.map(async (agentName) => {
        const bridgeModel = await resolveModelForJobAgent(agentName);
        return prisma.job.create({
          data: {
            ideaId: id,
            agentName,
            status: "PENDING",
            input: JSON.stringify({ ...baseInput, _bridgeModel: bridgeModel }),
          },
        });
      })
    );

    return NextResponse.json({
      status: "VALIDATING",
      validationStatus: "RUNNING",
      jobs: jobs.map((j) => ({ id: j.id, agentName: j.agentName, status: j.status })),
    });
  } catch (error) {
    console.error("[POST /api/ideas/:id/validate]", error);
    return NextResponse.json(
      { error: "Error al iniciar la validación" },
      { status: 500 }
    );
  }
}
