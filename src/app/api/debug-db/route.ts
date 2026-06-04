import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const ideas = await prisma.idea.findMany({ take: 1 });
    return NextResponse.json({ ok: true, count: ideas.length });
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 });
  }
}
