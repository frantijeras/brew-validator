import { prisma } from "./db";

/**
 * One-time backfill: for every Report that has no ideaVersionId, attach it
 * to the Idea's currentVersionId (or, as a safety net, its most recent
 * IdeaVersion by createdAt). Reports are owned by the Idea, not by a
 * specific version, so we anchor them to the version that was active at
 * backfill time.
 *
 * Returns the number of Reports updated.
 */
export async function backfillReportVersionId(): Promise<number> {
  const ideasWithReports = await prisma.idea.findMany({
    where: {
      reports: {
        some: { ideaVersionId: null },
      },
    },
    include: {
      currentVersion: { select: { id: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (ideasWithReports.length === 0) return 0;

  let updated = 0;
  for (const idea of ideasWithReports) {
    const targetVersionId =
      idea.currentVersionId ?? idea.versions[0]?.id ?? null;
    if (!targetVersionId) continue;

    const result = await prisma.report.updateMany({
      where: { ideaId: idea.id, ideaVersionId: null },
      data: { ideaVersionId: targetVersionId },
    });
    updated += result.count;
  }

  console.log(
    `[backfillReportVersionId] Updated ${updated} report(s) across ${ideasWithReports.length} idea(s)`
  );
  return updated;
}
