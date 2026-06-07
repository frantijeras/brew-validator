/**
 * migrate-phase-sortorder.ts
 *
 * Reshifts ProjectPhase.sortOrder so the (legacy) `sortOrder: 0` for the
 * ANALYSIS phase becomes `sortOrder: 1`, leaving `sortOrder: 0` available
 * for the hardcoded "Validación de Idea" card in the project view.
 *
 * Mapping applied per project (only for these types):
 *   ANALYSIS    0 -> 1
 *   IDENTITY    1 -> 2
 *   CONTENT     2 -> 3
 *   DEVELOPMENT 3 -> 4
 *   BUSINESS    4 -> 5
 *   EXECUTION   5 -> 6
 *
 * Idempotence guards (per project):
 *   1. Only runs if the phase with sortOrder=0 is of type ANALYSIS.
 *      (If a project has already been migrated, sortOrder=0 is no longer
 *      a DB phase, so this guard is satisfied and the script no-ops.)
 *   2. Only runs if NO phase already has sortOrder=6 (target final slot).
 *
 * Run:  npx tsx scripts/migrate-phase-sortorder.ts
 */
import { prisma } from "../src/lib/db";
import { PhaseType } from "@prisma/client";

const TARGET_TYPES: PhaseType[] = [
  PhaseType.ANALYSIS,
  PhaseType.IDENTITY,
  PhaseType.CONTENT,
  PhaseType.DEVELOPMENT,
  PhaseType.BUSINESS,
  PhaseType.EXECUTION,
];

// Build the per-type shift map (0->1, 1->2, ..., 5->6).
const SHIFT_MAP: Record<string, number> = {};
TARGET_TYPES.forEach((t, idx) => {
  SHIFT_MAP[t] = idx + 1; // old sortOrder = idx -> new sortOrder = idx + 1
});

async function main() {
  console.log("🔍 Inspecting existing projects…");

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      phases: { select: { id: true, type: true, sortOrder: true } },
    },
  });

  console.log(`Found ${projects.length} project(s).\n`);

  let migrated = 0;
  let skipped = 0;
  let warnings = 0;

  for (const project of projects) {
    console.log(`── Project ${project.id} (${project.name})`);

    const phases = [...project.phases].sort((a, b) => a.sortOrder - b.sortOrder);

    // Guard 1: skip if sortOrder=0 is not an ANALYSIS phase (already migrated
    // or has a non-target phase there).
    const sortZero = phases.find((p) => p.sortOrder === 0);
    if (!sortZero) {
      console.log("   ⏭  no phase at sortOrder=0 — already migrated. Skip.\n");
      skipped++;
      continue;
    }
    if (sortZero.type !== PhaseType.ANALYSIS) {
      console.log(
        `   ⏭  sortOrder=0 belongs to ${sortZero.type}, not ANALYSIS — skip.\n`,
      );
      skipped++;
      continue;
    }

    // Guard 2: skip if a phase already has sortOrder=6 (target end).
    const hasSort6 = phases.some((p) => p.sortOrder === 6);
    if (hasSort6) {
      console.log("   ⏭  a phase already has sortOrder=6 — already migrated. Skip.\n");
      skipped++;
      continue;
    }

    // Apply shifts for the 6 target types only. Other types (e.g. legacy
    // DOSSIER) are left untouched, so a collision with the new sortOrder
    // values is possible on legacy data — we warn but don't auto-resolve.
    const updates: { id: string; oldOrder: number; newOrder: number; type: string }[] = [];
    for (const phase of phases) {
      const newOrder = SHIFT_MAP[phase.type];
      if (newOrder === undefined) continue; // not in target types
      if (phase.sortOrder === newOrder) continue; // already correct
      updates.push({
        id: phase.id,
        oldOrder: phase.sortOrder,
        newOrder,
        type: phase.type,
      });
    }

    if (updates.length === 0) {
      console.log("   ℹ️  no target-type phases need shifting. Skip.\n");
      skipped++;
      continue;
    }

    // Detect collisions with non-target types (e.g. legacy DOSSIER sitting at sortOrder=4).
    const targetIds = new Set(updates.map((u) => u.id));
    const newOrderOwners = new Set(updates.map((u) => u.newOrder));
    const colliding = phases.filter(
      (p) => !targetIds.has(p.id) && newOrderOwners.has(p.sortOrder),
    );
    if (colliding.length > 0) {
      warnings++;
      console.log(
        `   ⚠️  WARNING: would collide with legacy non-target phase(s) at:`,
      );
      for (const c of colliding) {
        console.log(`        - type=${c.type} sortOrder=${c.sortOrder} (id=${c.id})`);
      }
      console.log(
        "      Proceeding with the shift anyway — you'll need to fix these manually if you want clean numbering.",
      );
    }

    // Apply updates one-by-one in a transaction. We do it in a transaction
    // so a failure mid-way leaves the project untouched.
    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.projectPhase.update({
          where: { id: u.id },
          data: { sortOrder: u.newOrder },
        });
      }
    });

    console.log("   ✅ Migrated:");
    for (const u of updates) {
      console.log(`        - ${u.type}: ${u.oldOrder} → ${u.newOrder}  (id=${u.id})`);
    }
    console.log();
    migrated++;
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} warnings=${warnings}`);
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
