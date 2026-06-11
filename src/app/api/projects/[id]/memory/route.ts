import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { guardProject } from "@/lib/ownership";
import {
  mergeProjectMemory,
  type ProjectMemory,
  type MemoryEntry,
  type MemorySource,
} from "@/lib/project-memory";

/**
 * GET /api/projects/[id]/memory
 * Devuelve la memoria acumulativa del proyecto.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { memory: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      memory: (project.memory as ProjectMemory) ?? null,
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/memory error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/projects/[id]/memory
 *
 * Dos modos:
 *   1. Modo bulk: { memory: Record<string, MemoryEntry> }
 *   2. Modo single-key: { key: string, value: unknown, rationale?: string }
 *
 * En ambos casos se mergea con mergeProjectMemory usando source = "user".
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;
    const body = await req.json();

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, memory: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentMemory = (project.memory as ProjectMemory) ?? {};

    // Build incoming entries
    let incoming: Partial<Record<string, MemoryEntry>>;

    if (body.memory && typeof body.memory === "object") {
      // Bulk mode
      incoming = body.memory;
    } else if (body.key && typeof body.key === "string") {
      // Single-key mode
      const now = new Date().toISOString();
      incoming = {
        [body.key]: {
          value: body.value,
          source: "user",
          updatedAt: now,
          rationale: body.rationale,
        },
      };
    } else {
      return NextResponse.json(
        { error: 'Must provide "memory" object or "key" + "value"' },
        { status: 400 },
      );
    }

    // Ensure all incoming entries have the correct source and timestamp
    const now = new Date().toISOString();
    for (const [key, entry] of Object.entries(incoming)) {
      if (entry) {
        entry.source = "user" as MemorySource;
        if (!entry.updatedAt) entry.updatedAt = now;
      }
    }

    const merged = mergeProjectMemory(currentMemory, incoming, "user");

    const updated = await prisma.project.update({
      where: { id },
      data: { memory: merged as unknown as Prisma.InputJsonValue },
      select: { id: true, memory: true },
    });

    return NextResponse.json({
      memory: updated.memory as ProjectMemory,
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/memory error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
