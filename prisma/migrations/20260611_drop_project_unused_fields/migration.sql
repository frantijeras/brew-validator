-- Drop Project.buyerPersona: never written or read in application code (0 rows with data).
ALTER TABLE "Project" DROP COLUMN IF EXISTS "buyerPersona";

-- Drop Project.status: only ever written as "ACTIVE" on creation, never used as a filter or read.
ALTER TABLE "Project" DROP COLUMN IF EXISTS "status";
