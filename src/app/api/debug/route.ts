import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get all values of the enum IdeaStatus
    const enumValues: any = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'IdeaStatus'
      )
      ORDER BY enumsortorder
    `;
    
    return NextResponse.json({ ok: true, enumValues });
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message
    }, { status: 500 });
  }
}
