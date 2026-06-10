-- AlterEnum: Remove DEVELOPMENT and DOSSIER from PhaseType enum
-- Since PostgreSQL doesn't support ALTER TYPE ... DROP VALUE, we:
-- 1. Create a new type without the removed values
-- 2. Migrate the column
-- 3. Drop the old type

-- Create new enum type
CREATE TYPE "PhaseType_new" AS ENUM ('IDENTITY', 'ANALYSIS', 'CONTENT', 'BUSINESS', 'EXECUTION');

-- Migrate column (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'ProjectPhase') THEN
    ALTER TABLE "ProjectPhase" ALTER COLUMN "type" DROP DEFAULT;
    ALTER TABLE "ProjectPhase" ALTER COLUMN "type" TYPE TEXT;
    UPDATE "ProjectPhase" SET "type" = 'EXECUTION' WHERE "type" = 'DEVELOPMENT';
    UPDATE "ProjectPhase" SET "type" = 'EXECUTION' WHERE "type" = 'DOSSIER';
    ALTER TABLE "ProjectPhase" ALTER COLUMN "type" TYPE "PhaseType_new" USING "type"::"PhaseType_new";
    ALTER TABLE "ProjectPhase" ALTER COLUMN "type" SET DEFAULT 'EXECUTION';
  END IF;
END $$;

-- Drop old enum type
DROP TYPE "PhaseType";

-- Rename new type
ALTER TYPE "PhaseType_new" RENAME TO "PhaseType";
