-- AlterTable
ALTER TABLE "ProjectPhase" ADD COLUMN "subStep" TEXT;
ALTER TABLE "ProjectPhase" ADD COLUMN "subStepArtifact" JSONB;
ALTER TABLE "ProjectPhase" ADD COLUMN "subStepChoice" TEXT;
