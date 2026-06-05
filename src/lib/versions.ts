import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Compute the next version phase string (e.g. "v1", "v2", "v3")
 * for an idea, counting only versions whose phase starts with "v".
 *
 * Pass an optional `tx` (Prisma transaction client) to run the count
 * inside an existing transaction.
 */
export async function getNextVersionPhase(
  ideaId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx ?? prisma;
  const versionCount = await client.ideaVersion.count({
    where: {
      ideaId,
      phase: { startsWith: "v" },
    },
  });
  return `v${versionCount + 1}`;
}
