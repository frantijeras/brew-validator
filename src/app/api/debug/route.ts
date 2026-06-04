import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Query raw to see what's in the DB
    const result: any = await prisma.$queryRaw`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'Idea' AND column_name IN ('status', 'validationStatus')
    `;
    
    // Try to read a single row with raw SQL
    const rawIdea: any = await prisma.$queryRaw`SELECT id, status FROM "Idea" LIMIT 1`;
    
    return NextResponse.json({ 
      ok: true, 
      columns: result,
      sampleRow: rawIdea
    });
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      code: error.code,
      meta: error.meta
    }, { status: 500 });
  }
}
