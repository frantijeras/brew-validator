import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("[debug] testing prisma...");
    const ideas = await prisma.idea.findMany({ take: 1 });
    console.log("[debug] success:", ideas.length);
    return NextResponse.json({ ok: true, count: ideas.length });
  } catch (error: any) {
    console.error("[debug] error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    }, { status: 500 });
  }
}
