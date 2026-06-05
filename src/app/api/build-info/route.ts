import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // siempre fresh

export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    shortSha: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "desarrollo local",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    environment: process.env.VERCEL_ENV ?? "development",
    deployedAt: process.env.VERCEL_GIT_COMMIT_DATE ?? new Date().toISOString(),
  });
}
