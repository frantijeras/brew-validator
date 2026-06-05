import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Delete all phases first, then the project
    await prisma.projectPhase.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/projects/delete]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
