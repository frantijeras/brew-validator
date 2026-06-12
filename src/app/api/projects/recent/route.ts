import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { ideaOwnerWhere } from "@/lib/ownership";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Recientes = proyectos + ideas (las ideas que aún NO son proyecto, para no
    // duplicar). Cada elemento lleva `type` para que el sidebar muestre el icono
    // correcto (carpeta = proyecto, bombilla = idea) y enlace a la ruta correcta.
    const [projects, ideas] = await Promise.all([
      prisma.project.findMany({
        where: { idea: ideaOwnerWhere(auth.userId) },
        include: { phases: { orderBy: { sortOrder: "asc" } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.idea.findMany({
        where: { ...ideaOwnerWhere(auth.userId), project: null, isArchived: false },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    const projectItems = projects.map((p) => {
      const total = p.phases.length;
      const completedPhases = p.phases.filter((ph) => ph.status === "COMPLETED").length;
      const currentPhase = p.phases.find((ph) => ph.status !== "COMPLETED" && ph.status !== "LOCKED");
      return {
        type: "project" as const,
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        completedPhases,
        total,
        currentPhaseType: currentPhase?.type ?? null,
        status: p.phases.every((ph) => ph.status === "COMPLETED")
          ? "completed"
          : p.phases.some((ph) => ph.status === "PROCESSING")
            ? "processing"
            : p.phases.some((ph) => ph.status === "QUESTIONING")
              ? "questioning"
              : "available",
      };
    });

    const ideaItems = ideas.map((i) => ({
      type: "idea" as const,
      id: i.id,
      name: i.title,
      updatedAt: i.updatedAt,
      completedPhases: 0,
      total: 0,
      currentPhaseType: null,
      // Estado de la idea para el subtítulo/color (validación).
      status: (i.validationStatus || "PENDING").toLowerCase(),
    }));

    const items = [...projectItems, ...ideaItems]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3);

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
