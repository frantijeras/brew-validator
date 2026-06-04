import { prisma } from "./db";

/**
 * One-time backfill: sets currentVersionId on every Idea that has at least one
 * IdeaVersion but lacks currentVersionId. Uses the most recent version
 * (by createdAt desc) as the current one.
 */
export async function backfillCurrentVersion(): Promise<number> {
  const ideas = await prisma.idea.findMany({
    where: { currentVersionId: null },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (ideas.length === 0) return 0;

  let updated = 0;
  for (const idea of ideas) {
    if (idea.versions.length > 0) {
      await prisma.idea.update({
        where: { id: idea.id },
        data: { currentVersionId: idea.versions[0].id },
      });
      updated++;
    }
  }

  console.log(`[backfillCurrentVersion] Updated ${updated}/${ideas.length} ideas`);
  return updated;
}
